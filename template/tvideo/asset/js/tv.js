/* TVideo 主题交互脚本：依赖 jQuery 与系统 static_new/js/home.js（MAC 对象） */
(function ($, window, document) {
  'use strict';

  var cfg = window.maccms || {};
  var tv = cfg.tv || {};
  var PATH = cfg.path || '';
  var MOBILE = window.matchMedia('(max-width: 767px)');
  var HISTORY_KEY = 'tv_history';
  var HISTORY_MAX = 30;

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function isLogin() { return !!getCookie('user_id'); }
  function toast(msg, ms) {
    if (window.MAC && MAC.Pop && MAC.Pop.Msg) { MAC.Pop.Msg(0, 0, esc(msg), ms || 1500); return; }
    var el = document.createElement('div');
    el.className = 'tv-share-tip';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 1500);
  }
  function post(url, data) {
    return $.ajax({
      url: url,
      type: 'post',
      dataType: 'json',
      data: data,
      timeout: 10000,
      headers: cfg.csrfToken ? { 'X-CSRF-Token': cfg.csrfToken } : {}
    });
  }
  function loginUrl() {
    var url = tv.login || PATH + '/index.php/user/login.html';
    // 登录 / 注册 / 找回密码页本身不作为回跳地址
    if (/\/user\/(login|reg|findpass)/.test(location.pathname)) return url;
    return url + '?ref=' + encodeURIComponent(location.pathname + location.search);
  }

  /* ---------- 顶栏：滚动后变实色 ---------- */
  function initTopbar() {
    var top = qs('[data-tv-top]');
    if (!top) return;
    var ticking = false;
    function update() {
      ticking = false;
      top.classList.toggle('is-solid', window.scrollY > 40);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- 下拉菜单（触屏点击展开） ---------- */
  function initDropdowns() {
    qsa('[data-tv-dropdown]').forEach(function (box) {
      var btn = box.firstElementChild;
      if (!btn || btn.tagName !== 'BUTTON') return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        box.classList.toggle('is-open');
      });
    });
    document.addEventListener('click', function (e) {
      qsa('[data-tv-dropdown].is-open').forEach(function (box) {
        if (!box.contains(e.target)) box.classList.remove('is-open');
      });
    });
  }

  /* ---------- 焦点图 ---------- */
  function initBanner() {
    var root = qs('[data-tv-banner]');
    if (!root) return;
    var slides = qsa('.tv-hero__slide', root);
    var thumbs = qsa('.tv-hero__thumb', root);
    var dots = qsa('.tv-hero__dots i', root);
    if (slides.length < 2) return;
    var DUR = 5000;
    var cur = 0;
    var timer = null;
    root.style.setProperty('--hero-dur', DUR / 1000 + 's');

    function go(i) {
      i = (i + slides.length) % slides.length;
      [slides, thumbs, dots].forEach(function (list) {
        list.forEach(function (el, k) {
          el.classList.toggle('is-active', k === i);
          if (k === i && el.classList.contains('tv-hero__thumb')) {
            var bar = el.querySelector('i');
            if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
          }
        });
      });
      var img = slides[i].querySelectorAll('img[loading="lazy"]');
      Array.prototype.forEach.call(img, function (m) { m.loading = 'eager'; });
      cur = i;
    }
    function play() { stop(); timer = setInterval(function () { go(cur + 1); }, DUR); root.classList.remove('is-paused'); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    thumbs.forEach(function (t, k) {
      t.addEventListener('mouseenter', function () { go(k); stop(); root.classList.add('is-paused'); });
      t.addEventListener('click', function () { go(k); });
    });
    var thumbBox = qs('.tv-hero__thumbs', root);
    if (thumbBox) thumbBox.addEventListener('mouseleave', play);

    var sx = 0, sy = 0, moved = false;
    root.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; stop(); }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (Math.abs(e.touches[0].clientX - sx) > 10) moved = true;
    }, { passive: true });
    root.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (moved && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
      play();
    });
    root.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);

    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
    play();
  }

  /* ---------- 横滑行 ---------- */
  function initRails(scope) {
    qsa('[data-tv-rail]', scope).forEach(function (rail) {
      if (rail.__tv) return;
      rail.__tv = true;
      var track = rail.querySelector('.tv-rail__track');
      if (!track) return;
      var prev = document.createElement('button');
      var next = document.createElement('button');
      prev.type = next.type = 'button';
      prev.className = 'tv-rail__btn tv-rail__btn--prev';
      next.className = 'tv-rail__btn tv-rail__btn--next';
      prev.setAttribute('aria-label', '向左');
      next.setAttribute('aria-label', '向右');
      prev.innerHTML = '<svg class="tv-ico"><use href="#i-left"/></svg>';
      next.innerHTML = '<svg class="tv-ico"><use href="#i-right"/></svg>';
      rail.appendChild(prev);
      rail.appendChild(next);
      function sync() {
        var pic = track.querySelector('.tv-card__pic');
        if (pic) rail.style.setProperty('--btn-h', pic.offsetHeight + 'px');
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      }
      prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth * 0.9, behavior: 'smooth' }); });
      next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth * 0.9, behavior: 'smooth' }); });
      track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
      window.addEventListener('resize', sync);
      sync();
      setTimeout(sync, 600);
    });
  }

  /* ---------- 通用 tab ---------- */
  function initTabs() {
    qsa('[data-tv-tabs]').forEach(function (box) {
      var btns = qsa('[data-tab]', box);
      var panels = qsa('[data-panel]', box);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var key = b.getAttribute('data-tab');
          btns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
          panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== key; });
        });
      });
    });
  }

  /* ---------- 选集：线路切换与 30 集分组 ---------- */
  function initEps() {
    qsa('[data-tv-eps]').forEach(function (box) {
      qsa('[data-line]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var sid = b.getAttribute('data-line');
          qsa('[data-line]', box).forEach(function (x) { x.classList.toggle('is-active', x === b); });
          qsa('[data-line-panel]', box).forEach(function (p) { p.hidden = p.getAttribute('data-line-panel') !== sid; });
        });
      });
      qsa('.tv-eps__panel', box).forEach(function (panel) {
        qsa('.tv-eps__group', panel).forEach(function (g) {
          g.addEventListener('click', function () {
            var no = g.getAttribute('data-group');
            qsa('.tv-eps__group', panel).forEach(function (x) { x.classList.toggle('is-active', x === g); });
            qsa('.tv-eps__item', panel).forEach(function (it) { it.hidden = it.getAttribute('data-group') !== no; });
          });
        });
      });
      var cur = box.querySelector('.tv-eps__item.is-cur');
      if (cur) {
        var list = cur.parentNode;
        if (list.scrollWidth > list.clientWidth) list.scrollLeft = cur.offsetLeft - list.clientWidth / 2 + cur.clientWidth / 2;
        var scroller = cur.closest('.tv-eps');
        if (scroller && scroller.scrollHeight > scroller.clientHeight) scroller.scrollTop = cur.offsetTop - scroller.offsetTop - 60;
      }
    });
  }

  /* ---------- 简介展开 ---------- */
  function initExpand() {
    qsa('[data-tv-expand]').forEach(function (box) {
      var body = box.querySelector('[data-tv-expand-body]');
      var btn = box.querySelector('[data-tv-expand-btn]');
      if (!body || !btn) return;
      // defer 脚本执行时样式未必已生效（WebKit），load / resize 时再测一次是否溢出
      var check = function () {
        if (!box.classList.contains('is-open')) btn.hidden = body.scrollHeight <= body.clientHeight + 4;
      };
      check();
      window.addEventListener('load', check);
      window.addEventListener('resize', check);
      btn.addEventListener('click', function () {
        box.classList.toggle('is-open');
        var t = btn.childNodes[0];
        if (t && t.nodeType === 3 && box.querySelector('.tv-detail__desc-btn')) t.nodeValue = box.classList.contains('is-open') ? '收起' : '展开';
      });
    });
  }

  /* ---------- 筛选行：选中项滚到可视区 ---------- */
  function initFilterRows() {
    qsa('[data-tv-filter-row]').forEach(function (row) {
      var a = row.querySelector('.is-active');
      if (a && row.scrollWidth > row.clientWidth) row.scrollLeft = a.offsetLeft - row.clientWidth / 2;
    });
  }

  /* ---------- 搜索联想 ---------- */
  function initSearch() {
    var form = qs('[data-tv-search]');
    if (!form) return;
    var input = form.querySelector('input[name="wd"]');
    var box = form.querySelector('[data-tv-suggest]');
    var hot = (form.getAttribute('data-hot') || '').split(',').filter(Boolean);
    var timer = null, seq = 0, items = [], idx = -1;

    form.addEventListener('submit', function (e) {
      if (!input.value.trim()) {
        if (input.placeholder && hot.indexOf(input.placeholder) > -1) { input.value = input.placeholder; return; }
        e.preventDefault();
        input.focus();
      }
    });
    function render(list, label, isHot) {
      items = list;
      idx = -1;
      if (!list.length) { box.hidden = true; return; }
      var html = '<p class="tv-suggest__label">' + esc(label) + '</p>';
      list.forEach(function (it, i) {
        html += '<a class="tv-suggest__item" href="' + esc(it.url) + '">' + (isHot ? '<em>' + (i + 1) + '</em>' : '<svg class="tv-ico"><use href="#i-search"/></svg>') + '<span>' + esc(it.name) + '</span></a>';
      });
      box.innerHTML = html;
      box.hidden = false;
    }
    function searchUrl(w) {
      var base = tv.search || PATH + '/index.php/vod/search.html';
      return base + (base.indexOf('?') > -1 ? '&' : '?') + 'wd=' + encodeURIComponent(w);
    }
    function showHot() {
      render(hot.slice(0, 10).map(function (w) { return { name: w, url: searchUrl(w) }; }), '热门搜索', true);
    }
    function query() {
      var w = input.value.trim();
      if (!w) { showHot(); return; }
      var my = ++seq;
      $.getJSON(PATH + '/index.php/ajax/suggest', { mid: 1, wd: w, limit: 8 }).done(function (r) {
        if (my !== seq) return;
        var list = (r && r.list) || [];
        render(list.map(function (it) {
          var url = it.url ? String(it.url).replace('mac_wd', encodeURIComponent(it.name)) : searchUrl(it.name);
          return { name: it.name, url: url };
        }), '搜索建议', false);
      });
    }
    input.addEventListener('focus', function () { input.value.trim() ? query() : showHot(); });
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(query, 220); });
    input.addEventListener('keydown', function (e) {
      var links = qsa('.tv-suggest__item', box);
      if (!links.length || box.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === idx); });
      } else if (e.key === 'Enter' && idx > -1) {
        e.preventDefault();
        location.href = links[idx].href;
      } else if (e.key === 'Escape') {
        box.hidden = true;
      }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) box.hidden = true; });
  }

  /* ---------- 本地观看历史 ---------- */
  function readHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function writeHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) {}
  }
  function recordHistory() {
    var el = qs('[data-tv-history]');
    if (!el) return;
    var item = {
      id: el.getAttribute('data-id'),
      name: el.getAttribute('data-name'),
      part: el.getAttribute('data-part'),
      pic: el.getAttribute('data-pic'),
      link: el.getAttribute('data-link') || location.pathname,
      t: Date.now()
    };
    var list = readHistory().filter(function (h) { return String(h.id) !== String(item.id); });
    list.unshift(item);
    writeHistory(list);
  }
  function timeAgo(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' 分钟前';
    if (s < 86400) return Math.round(s / 3600) + ' 小时前';
    return Math.round(s / 86400) + ' 天前';
  }
  function renderHistory() {
    var list = readHistory();
    var menu = qs('[data-tv-history-list]');
    if (menu && list.length) {
      var html = '<div class="tv-menu__title"><span>观看历史</span><button type="button" data-tv-history-clear>清空</button></div>';
      list.slice(0, 6).forEach(function (h) {
        html += '<a class="tv-hist" href="' + esc(h.link) + '"><img src="' + esc(h.pic) + '" alt="" loading="lazy" data-ph="h"><div><p class="tv-hist__t">' + esc(h.name) + '</p><p class="tv-hist__s">' + (h.part ? '看到 ' + esc(h.part) + ' · ' : '') + timeAgo(h.t) + '</p></div></a>';
      });
      if (isLogin()) html += '<a href="' + esc(tv.plays || '#') + '">查看全部播放记录</a>';
      menu.innerHTML = html;
      var clr = menu.querySelector('[data-tv-history-clear]');
      if (clr) clr.addEventListener('click', function (e) {
        e.stopPropagation();
        writeHistory([]);
        menu.innerHTML = '<p class="tv-menu__empty">暂无观看记录</p>';
        qsa('[data-tv-continue]').forEach(function (s) { s.hidden = true; });
      });
    }
    qsa('[data-tv-continue]').forEach(function (sec) {
      var track = sec.querySelector('[data-tv-continue-list]');
      if (!track || !list.length) return;
      track.innerHTML = list.slice(0, 12).map(function (h) {
        return '<a class="tv-card tv-card--h" href="' + esc(h.link) + '"><div class="tv-card__pic"><img src="' + esc(h.pic) + '" alt="" loading="lazy" data-ph="h"><span class="tv-card__note">' + timeAgo(h.t) + '</span></div><p class="tv-card__title">' + esc(h.name) + '</p><p class="tv-card__sub">' + (h.part ? '看到 ' + esc(h.part) : '') + '</p></a>';
      }).join('');
      sec.hidden = false;
      initRails(sec);
    });
  }

  /* ---------- 登录：PC 弹窗，H5 跳转登录页 ---------- */
  function openLogin() {
    if (MOBILE.matches || !(window.MAC && MAC.Pop)) { location.href = loginUrl(); return; }
    var ac = isLogin() ? 'ajax_info' : 'ajax_login';
    MAC.Pop.Show(400, 0, isLogin() ? '我的账号' : '登录', PATH + '/index.php/user/' + ac, function () {
      var form = qs('.mac_pop [data-tv-ajax-form]');
      if (form) bindAjaxForm(form);
      var first = qs('.mac_pop input[name="user_name"]');
      if (first) first.focus();
    });
  }
  function logout() {
    post(PATH + '/index.php/user/logout', {}).always(function () {
      location.href = location.pathname.indexOf('/user') > -1 ? (cfg.path_assets || '/') : location.href;
    });
  }

  /* ---------- 通用 AJAX 表单 ---------- */
  function bindAjaxForm(form) {
    if (form.__tv) return;
    form.__tv = true;
    var msg = form.querySelector('[data-tv-form-msg]');
    function say(text, ok) {
      if (msg) { msg.textContent = text || ''; msg.classList.toggle('is-ok', !!ok); }
      else if (text) toast(text);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      var p1 = form.querySelector('[name="user_pwd2"]');
      var p0 = form.querySelector('[name="user_pwd1"]') || form.querySelector('[name="user_pwd"]');
      if (p1 && p0 && p1.value !== p0.value) { say('两次输入的密码不一致'); return; }
      if (btn) btn.classList.add('is-loading');
      say('');
      post(form.getAttribute('action'), $(form).serialize()).done(function (r) {
        r = r || {};
        if (Number(r.code) === 1) {
          say(r.msg || '操作成功', true);
          var ref = new URLSearchParams(location.search).get('ref');
          var to = (form.hasAttribute('data-use-ref') && ref && ref.charAt(0) === '/' && ref.charAt(1) !== '/') ? ref : form.getAttribute('data-success');
          setTimeout(function () {
            if (form.hasAttribute('data-reload') || !to) location.reload();
            else location.href = to;
          }, 500);
        } else {
          say(r.msg || '操作失败，请重试');
          var img = form.querySelector('img.mac_verify_img');
          if (img) img.src = PATH + '/index.php/verify/index.html?r=' + Math.random();
          var v = form.querySelector('[name="verify"]');
          if (v) v.value = '';
        }
      }).fail(function () {
        say('网络错误，请稍后重试');
      }).always(function () {
        if (btn) btn.classList.remove('is-loading');
      });
    });
  }
  function initForms() {
    qsa('[data-tv-ajax-form]').forEach(bindAjaxForm);
    $(document).on('click', '[data-tv-send-code]', function () {
      var btn = this;
      var form = btn.closest('form');
      var to = form.querySelector('[name="to"]');
      if (!to || !to.value.trim()) { toast('请先填写' + (to && to.type === 'tel' ? '手机号' : '邮箱')); return; }
      btn.disabled = true;
      post(btn.getAttribute('data-tv-send-code'), $(form).serialize()).done(function (r) {
        toast((r && r.msg) || '已发送');
        if (r && Number(r.code) === 1) {
          var n = 60;
          var t = setInterval(function () {
            btn.textContent = n + ' 秒后重发';
            if (--n < 0) { clearInterval(t); btn.disabled = false; btn.textContent = '获取验证码'; }
          }, 1000);
        } else {
          btn.disabled = false;
        }
      }).fail(function () { btn.disabled = false; toast('发送失败'); });
    });
  }

  /* ---------- 收藏 ---------- */
  function initFav() {
    $(document).on('click', '[data-tv-fav]', function () {
      var btn = this;
      if (!isLogin()) { openLogin(); return; }
      if (btn.classList.contains('is-loading')) return;
      var id = btn.getAttribute('data-id');
      var label = btn.querySelector('span');
      var on = btn.classList.contains('is-on');
      btn.classList.add('is-loading');
      function setOn(v, ulog) {
        btn.classList.toggle('is-on', v);
        if (label) label.textContent = v ? '已收藏' : '收藏';
        if (ulog !== undefined) btn.setAttribute('data-ulog', ulog);
      }
      function done() { btn.classList.remove('is-loading'); }
      if (!on) {
        post(PATH + '/index.php/user/ajax_ulog/?ac=set', { mid: 1, id: id, type: 2, __token__: cfg.csrfToken || '' }).done(function (r) {
          if (r && Number(r.code) === 1) { setOn(true, ''); toast('已加入收藏'); }
          else toast((r && r.msg) || '收藏失败');
        }).fail(function () { toast('收藏失败'); }).always(done);
        return;
      }
      var ulog = btn.getAttribute('data-ulog');
      var find = ulog && ulog !== '0' ? $.Deferred().resolve(ulog) : $.getJSON(PATH + '/index.php/user/ajax_ulog/', { ac: 'list', mid: 1, id: id, type: 2, limit: 1 }).then(function (r) {
        return r && r.list && r.list[0] ? r.list[0].ulog_id : '';
      });
      find.then(function (uid) {
        if (!uid) { setOn(false, ''); done(); return; }
        post(PATH + '/index.php/user/ulog_del', { ids: uid, type: 2 }).done(function (r) {
          if (r && Number(r.code) === 1) { setOn(false, ''); toast('已取消收藏'); }
          else toast((r && r.msg) || '操作失败');
        }).always(done);
      }, done);
    });
  }

  /* ---------- 个人中心：异步加载记录、删除记录 ---------- */
  function initUlog() {
    qsa('[data-tv-ulog-list]').forEach(function (track) {
      var type = track.getAttribute('data-type');
      var card = track.getAttribute('data-card') || 'v';
      var sec = track.closest('.tv-sec');
      var empty = sec && sec.querySelector('[data-tv-ulog-empty]');
      $.getJSON(PATH + '/index.php/user/ajax_ulog/', { ac: 'list', mid: 1, type: type, limit: track.getAttribute('data-limit') || 12 }).done(function (r) {
        var list = (r && r.list) || [];
        list = list.filter(function (x) { return x.data && x.data.name; });
        if (!list.length) { if (empty) empty.hidden = false; track.closest('.tv-rail').hidden = true; return; }
        track.innerHTML = list.map(function (x) {
          var d = x.data;
          var note = Number(x.ulog_nid) > 0 && type !== '2' ? '<span class="tv-card__note">第' + esc(x.ulog_nid) + '集</span>' : '';
          return '<a class="tv-card tv-card--' + card + '" href="' + esc(d.link) + '"><div class="tv-card__pic"><img src="' + esc(d.pic) + '" alt="" loading="lazy" data-ph="' + card + '">' + note + '</div><p class="tv-card__title">' + esc(d.name) + '</p><p class="tv-card__sub">' + esc(d.type && d.type.type_name || '') + '</p></a>';
        }).join('');
        initRails(sec);
      });
    });
    $(document).on('click', '[data-tv-ulog-del]', function (e) {
      e.preventDefault();
      var btn = this;
      post(PATH + '/index.php/user/ulog_del', { ids: btn.getAttribute('data-tv-ulog-del'), type: btn.getAttribute('data-type') }).done(function (r) {
        if (r && Number(r.code) === 1) {
          var item = btn.closest('.tv-uc-item');
          if (item) item.remove();
          toast('已删除');
        } else toast((r && r.msg) || '删除失败');
      });
    });
    $(document).on('click', '[data-tv-ulog-clear]', function () {
      if (!window.confirm('确定清空全部记录吗？')) return;
      post(PATH + '/index.php/user/ulog_del', { all: 1, type: this.getAttribute('data-type') }).done(function (r) {
        if (r && Number(r.code) === 1) location.reload();
        else toast((r && r.msg) || '操作失败');
      });
    });
  }

  /* ---------- 分享、复制、报错 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  function initShare() {
    $(document).on('click', '[data-tv-share]', function () {
      var title = this.getAttribute('data-title') || document.title;
      var url = location.href;
      if (navigator.share && MOBILE.matches) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      copyText(title + ' ' + url).then(function () { toast('链接已复制，快去分享吧'); }, function () { toast('复制失败，请手动复制地址栏链接'); });
    });
    $(document).on('click', '[data-tv-copy]', function () {
      copyText(this.getAttribute('data-tv-copy')).then(function () { toast('已复制'); }, function () { toast('复制失败'); });
    });
    $(document).on('click', '[data-tv-report]', function () {
      if (window.MAC && MAC.Gbook) MAC.Gbook.Report(this.getAttribute('data-name'), this.getAttribute('data-id'));
    });
  }

  /* ---------- 播放页 ---------- */
  function initPlayer() {
    var player = qs('[data-tv-player]');
    var side = qs('[data-tv-side]');
    if (player && side && window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (window.matchMedia('(min-width: 1024px)').matches) side.style.height = player.offsetHeight + 'px';
        else side.style.height = '';
      });
      ro.observe(player);
    }
    // 加载层：DPlayer 可播（play_ok）后淡出，失败（play_fail）时提示换线路；
    // 不发消息的播放器（iframe / 外链类线路）6 秒内没收到 ready 就直接淡出，发了 ready 的最多等 25 秒
    var loading = player && qs('[data-tv-player-loading]', player);
    var done = function (fail) {
      if (!loading || player.classList.contains('is-ready') || player.classList.contains('is-fail')) return;
      if (fail) {
        player.classList.add('is-fail');
        var msg = qs('[data-tv-player-msg]', loading);
        if (msg) msg.textContent = '视频加载失败，请尝试切换线路或稍后再试';
      } else {
        player.classList.add('is-ready');
      }
    };
    var waitReady = loading ? setTimeout(function () { done(false); }, 6000) : 0;
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.source !== 'mac-player') return;
      if (e.data.type === 'ready') {
        clearTimeout(waitReady);
        waitReady = setTimeout(function () { done(false); }, 25000);
      }
      if (e.data.type === 'play_ok' || e.data.type === 'playing') done(false);
      if (e.data.type === 'play_fail') done(true);
      if (e.data.type === 'web_fullscreen' && player) {
        player.classList.toggle('is-webfs', !!e.data.on);
        document.documentElement.style.overflow = e.data.on ? 'hidden' : '';
      }
    });
    // 自动播放被浏览器拦截而静音起播时，页面上的第一次点击/按键就恢复声音。
    // 必须在事件处理中同步调用同源 iframe 的函数：改用 postMessage 会丢失用户手势，Safari 仍会拒绝开声
    var unmute = function () {
      if (!player) return;
      qsa('iframe', player).forEach(function (f) {
        try { if (f.contentWindow && f.contentWindow.tvAutoUnmute) f.contentWindow.tvAutoUnmute(); } catch (err) {}
      });
    };
    document.addEventListener('click', unmute, true);
    document.addEventListener('keydown', unmute, true);
    // player.js 会把 window.onerror 设成吞掉所有错误，这里恢复，方便排查
    if (window.onerror && String(window.onerror).indexOf('return true') > -1) window.onerror = null;
  }

  /* ---------- 评论 / 留言 ---------- */
  function initComment() {
    if (!window.MAC) return;
    var box = qs('.mac_comment');
    if (box && MAC.Comment) {
      MAC.Comment.Login = Number(box.getAttribute('data-login')) || 0;
      MAC.Comment.Verify = Number(box.getAttribute('data-verify')) || 0;
      MAC.Comment.Init();
      MAC.Comment.Show(1);
    }
    if (MAC.Gbook) {
      var gf = qs('.gbook_form');
      MAC.Gbook.Login = gf ? Number(gf.getAttribute('data-login')) || 0 : 0;
      MAC.Gbook.Verify = gf ? Number(gf.getAttribute('data-verify')) || 0 : 0;
      MAC.Gbook.Init();
    }
  }

  /* ---------- 图片兜底 ---------- */
  function initImgFallback() {
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.__tvph) return;
      var kind = img.getAttribute('data-ph');
      if (!kind) return;
      img.__tvph = true;
      img.src = kind === 'h' ? (tv.ph_h || '') : (tv.ph_v || '');
    }, true);
  }

  /* ---------- 清理默认主题遗留的 Service Worker ---------- */
  function cleanSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
  }

  /* ---------- 覆盖系统登录入口 ---------- */
  function patchMAC() {
    if (!window.MAC) return;
    MAC.User.Login = openLogin;
    MAC.User.Logout = logout;
    $(document).on('click', '[data-tv-login]', function (e) {
      e.preventDefault();
      openLogin();
    });
    $(document).on('click', '[data-tv-logout]', function (e) {
      e.preventDefault();
      logout();
    });
    $(document).on('keydown', '.mac_pop', function (e) {
      if (e.key === 'Escape') MAC.Pop.Remove();
    });
    $(document).on('click', '.mac_pop_bg', function () { MAC.Pop.Remove(); });
  }

  $(function () {
    if (cfg.csrfToken) $.ajaxSetup({ headers: { 'X-CSRF-Token': cfg.csrfToken } });
    initImgFallback();
    patchMAC();
    initTopbar();
    initDropdowns();
    initBanner();
    initRails();
    initTabs();
    initEps();
    initExpand();
    initFilterRows();
    initSearch();
    recordHistory();
    renderHistory();
    initForms();
    initFav();
    initUlog();
    initShare();
    initPlayer();
    initComment();
    cleanSW();
  });
})(jQuery, window, document);
