/* 拦截系统 player.js 从 maccms 官方站加载的外部内容（预加载页、缓冲页、移动端 top10.js）。
 * 必须在 static/js/player.js 之前同步加载：通过 setter 截获 MacPlayer 对象并替换 Show/AdsStart。 */
(function (w) {
  'use strict';
  var BAD = /^(https?:)?\/\/([a-z0-9-]+\.)*maccms\.la(\/|$)/i;

  function clean(cfg) {
    if (!cfg) return;
    // 预加载页不再使用，首次加载由主题的 .tv-player__loading 展示；
    // 播放中缓冲时 dplayer.html 会用 MacPlayer.Buffer 盖一层 iframe，留空会回退到系统 loading.html，这里换成主题的透明转圈页
    cfg.prestrain = '';
    cfg.buffer = ((w.maccms && w.maccms.path_tpl) || '/template/tvideo/') + 'asset/player/buffer.html';
    cfg.second = 0;
  }
  function hideBuffer() {
    var b = document.getElementById('buffer');
    if (b) { b.removeAttribute('src'); b.style.display = 'none'; }
  }
  function patch(o) {
    if (!o || typeof o !== 'object' || o.__tvGuard) return o;
    o.__tvGuard = true;
    var init = o.Init;
    if (typeof init === 'function') {
      o.Init = function () {
        clean(w.MacPlayerConfig);
        return init.apply(this, arguments);
      };
    }
    o.Show = function () {
      hideBuffer();
      var p = document.getElementById('playleft');
      if (p) p.innerHTML = String(this.Html || '');
    };
    o.AdsStart = hideBuffer;
    o.AdsEnd = hideBuffer;
    return o;
  }

  var store;
  try {
    Object.defineProperty(w, 'MacPlayer', {
      configurable: true,
      enumerable: true,
      get: function () { return store; },
      set: function (v) { store = patch(v); }
    });
  } catch (e) {}

  // 兜底：万一有脚本仍然插入了 maccms.la 的 script/iframe，直接拦掉
  var origInsert = Node.prototype.insertBefore;
  var origAppend = Node.prototype.appendChild;
  function blocked(node) {
    return node && (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') && BAD.test(String(node.getAttribute && node.getAttribute('src') || node.src || ''));
  }
  Node.prototype.insertBefore = function (node, ref) {
    if (blocked(node)) return node;
    return origInsert.call(this, node, ref);
  };
  Node.prototype.appendChild = function (node) {
    if (blocked(node)) return node;
    return origAppend.call(this, node);
  };
})(window);
