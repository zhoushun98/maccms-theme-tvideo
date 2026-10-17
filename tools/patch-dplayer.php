<?php
/**
 * TVideo 播放器增强补丁：给 maccms10 自带的 static/player/dplayer.html 打补丁，可重复执行、可还原。
 *
 *   php tools/patch-dplayer.php /path/to/maccms10             打补丁
 *   php tools/patch-dplayer.php /path/to/maccms10 --restore   还原为原版
 *
 * 请以站点文件的属主执行（例如 sudo -u www-data php ...）。maccms 升级覆盖 dplayer.html 后重新执行一次即可。
 *
 * 补丁内容：
 * 1) 强制 hls.js：DPlayer 发现 canPlayType('application/vnd.apple.mpegURL') 为真就改走原生播放。新版 Chrome
 *    原生支持 HLS，但播不了 AES-128 加密的 m3u8（MEDIA_ERR_SRC_NOT_SUPPORTED）。支持 MSE 时改用自定义类型
 *    强制走 hls.js；不支持 MSE 的 iPhone Safari 仍走原生。
 * 2) 缓冲层不拦截点击：播放中缓冲时插入的 #customBuffer iframe 盖在控制栏上（z-index 999），
 *    让它不拦截点击，缓冲时也能暂停、拖动。
 * 3) 自动播放兜底：Safari 默认拦截有声自动播放，DPlayer 的 play() 被拒后直接暂停。改为自己发起自动播放：
 *    被拒（NotAllowedError）就静音重试，并提示“点击开启声音”；之后用户在画面或父页上的第一次点击/按键
 *    即恢复声音（主题的 tv.js 会同步调用 iframe 里的 window.tvAutoUnmute）。
 *
 * 另外给 static/player/*.js 里的 dplayer.html 地址追加 &tv=版本号，让浏览器重新拉取打过补丁的页面。
 * 每次都从原版（dplayer.html.orig）重新生成；当前文件不含补丁标记时（首次执行或 maccms 升级覆盖），以它为新的原版。
 */

const PATCH_VERSION = '1';

$root = null;
$restore = false;
foreach (array_slice($argv, 1) as $a) {
    if ($a === '--restore') {
        $restore = true;
    } else {
        $root = rtrim($a, '/');
    }
}
if ($root === null || !is_file($root . '/static/player/dplayer.html')) {
    fail("用法: php tools/patch-dplayer.php /path/to/maccms10 [--restore]\n"
        . ($root === null ? '' : "找不到 $root/static/player/dplayer.html\n"));
}

$file = $root . '/static/player/dplayer.html';
$cur = (string)file_get_contents($file);
$patched = strpos($cur, 'tvHls') !== false;

if ($restore) {
    if ($patched) {
        if (!is_file($file . '.orig')) {
            fail("找不到原版备份 $file.orig，无法还原\n");
        }
        copy($file . '.orig', $file) or fail("写入 $file 失败\n");
    }
    bump_player_js($root, null);
    echo "已还原 dplayer.html\n";
    exit(0);
}

if (!$patched) {
    copy($file, $file . '.orig') or fail("备份 $file 失败，请检查目录权限\n");
}
$html = (string)file_get_contents($file . '.orig');

$a1 = "\tif (videoCfg.quality && videoCfg.quality.length >= 2) {";
$a2 = "\tvar dp;\n\ttry {\n\t\tdp = new DPlayer(dpOpts);";
$a3 = "\tapplySavedSpeed(dp);\n\tbindSpeedMemory(dp);\n";
foreach ([$a1, $a2, $a3, '</head>'] as $anchor) {
    if (stripos($html, $anchor) === false) {
        fail("dplayer.html 结构与预期不符（找不到 " . json_encode($anchor, JSON_UNESCAPED_UNICODE) . "），未做任何修改。\n"
            . "本补丁基于 maccms10 v2026.1000.4056 的 dplayer.html，其他版本请提 issue。\n");
    }
}

$hls = <<<'JS'
    // tvideo：有 MSE 时强制 hls.js（原生 HLS 播不了 AES-128 加密流）
    if (type === 'hls' && window.Hls && Hls.isSupported()) {
        dpOpts.video.type = 'tvHls';
        dpOpts.video.customType = { tvHls: function (video) { var h = new Hls(); h.loadSource(video.src); h.attachMedia(video); } };
        (videoCfg.quality || []).forEach(function (q) { if (q.type === 'hls') q.type = 'tvHls'; });
    }

JS;
$autoplay = <<<'JS'
    // tvideo：浏览器拦截有声自动播放（Safari 默认如此）时改为静音播放，并提示点击开启声音。
    // 静音起播后，用户在画面上的第一次点击/按键恢复声音（点画面不暂停）；父页的点击通过 window.tvAutoUnmute 同步调用，保留用户手势
    var tvAutoMuted = false;
    function tvSetMuted(m) {
        if (!!dp.video.muted === m) return;
        var btn = dp.template && dp.template.volumeButtonIcon;
        // 走 DPlayer 自己的静音按钮，图标和音量条同步更新
        if (btn) btn.click();
        else dp.video.muted = m;
    }
    function tvUnmute() {
        if (!tvAutoMuted) return false;
        tvAutoMuted = false;
        tvSetMuted(false);
        var tip = document.getElementById('tvUnmute');
        if (tip) tip.parentNode.removeChild(tip);
        if (dp.video.paused) dp.play();
        return true;
    }
    window.tvAutoUnmute = tvUnmute;
    function tvUnmuteTip() {
        if (!dp.video.muted || document.getElementById('tvUnmute')) return;
        tvAutoMuted = true;
        var tip = document.createElement('button');
        tip.id = 'tvUnmute';
        tip.type = 'button';
        tip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9z" fill="currentColor"/><path d="m16 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>已静音，点击开启声音';
        dp.container.appendChild(tip);
    }
    dp.video.addEventListener('volumechange', function () {
        if (!tvAutoMuted || dp.video.muted) return;
        // 用户点了 DPlayer 自己的音量按钮
        tvAutoMuted = false;
        var tip = document.getElementById('tvUnmute');
        if (tip) tip.parentNode.removeChild(tip);
    });
    document.addEventListener('click', function (e) {
        if (!tvAutoMuted) return;
        var t = e.target;
        // 音量按钮交给 DPlayer 自己切换，否则会先开后关
        if (t.closest && t.closest('.dplayer-volume')) return;
        // 点画面本该切换暂停，这次只恢复声音
        if (t.closest && t.closest('.dplayer-video-wrap, #tvUnmute')) {
            e.stopPropagation();
            e.preventDefault();
        }
        tvUnmute();
    }, true);
    document.addEventListener('keydown', function () { tvUnmute(); }, true);
    (function tvAutoplay() {
        var p = dp.video.play();
        if (!p || typeof p.catch !== 'function') return;
        p.catch(function (e) {
            if (!e || e.name !== 'NotAllowedError') return;
            tvSetMuted(true);
            var p2 = dp.video.play();
            if (p2 && typeof p2.then === 'function') {
                // 静音也不让播（如 iOS 低电量模式）就恢复声音，等用户手动点播放
                p2.then(tvUnmuteTip, function () { tvSetMuted(false); });
            }
        });
    })();

JS;
$css = '<style id="tv-patch">#customBuffer{pointer-events:none}'
    . '#tvUnmute{position:absolute;left:16px;bottom:56px;z-index:1000;display:flex;align-items:center;gap:6px;height:36px;padding:0 16px 0 12px;border:0;border-radius:18px;'
    . 'background:rgba(0,0,0,.6);color:#fff;font:14px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer;'
    . '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:background-color .2s}'
    . '#tvUnmute:hover{background:rgba(0,0,0,.78)}#tvUnmute svg{width:20px;height:20px;color:#00d1d1}'
    . '@media (max-width:767px){#tvUnmute{left:10px;bottom:46px;height:30px;padding:0 12px 0 10px;font-size:12px}#tvUnmute svg{width:16px;height:16px}}'
    . '</style>';

$tab = function ($js) {
    return str_replace('    ', "\t", $js);
};
$html = str_replace($a1, $tab($hls) . $a1, $html);
$html = str_replace($a2, "\tdpOpts.autoplay = false; // tvideo：自动播放改由下方 tvAutoplay 发起\n" . $a2, $html);
$html = str_replace($a3, $a3 . $tab($autoplay), $html);
$html = preg_replace('~</head>~i', $css . "\n</head>", $html, 1);

if ($html !== $cur) {
    file_put_contents($file, $html, LOCK_EX) or fail("写入 $file 失败\n");
}
bump_player_js($root, PATCH_VERSION);
echo "dplayer.html 已打补丁（强制 hls.js、缓冲层不拦截点击、自动播放被拦时静音起播），原版备份为 dplayer.html.orig\n";

/**
 * 给 static/player/*.js 中 iframe 引用的 dplayer.html?v=… 追加（$ver 为 null 时去掉）&tv=版本号
 */
function bump_player_js($root, $ver)
{
    foreach (glob($root . '/static/player/*.js') ?: [] as $js) {
        $s = (string)file_get_contents($js);
        $n = preg_replace('/(dplayer\.html\?v=[^"\'&]*)(?:&tv=[^"\'&]*)?/', $ver === null ? '$1' : '$1&tv=' . $ver, $s);
        if ($n !== null && $n !== $s) {
            file_put_contents($js, $n, LOCK_EX) or fail("写入 $js 失败\n");
            echo '已更新 ' . basename($js) . " 中的 dplayer.html 地址\n";
        }
    }
}

function fail($msg)
{
    fwrite(STDERR, $msg);
    exit(1);
}
