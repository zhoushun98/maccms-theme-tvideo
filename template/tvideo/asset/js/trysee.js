/* 试看结束后用模板中的提示替换播放器 */
(function () {
  'use strict';
  var me = document.currentScript;
  var minutes = parseFloat(me && me.getAttribute('data-trysee')) || 0;
  if (minutes <= 0) return;
  var limit = minutes * 60;
  var ended = false;
  function end() {
    if (ended) return;
    ended = true;
    var tpl = document.getElementById('tv-trysee-end');
    var box = document.querySelector('.MacPlayer') || document.querySelector('.tv-player');
    if (tpl && box) box.innerHTML = tpl.innerHTML;
  }
  function watch() {
    var frame = document.querySelector('#playleft iframe');
    var doc = null;
    try { doc = frame && frame.contentDocument; } catch (e) {}
    var v = (doc && doc.querySelector('video')) || document.querySelector('video');
    if (!v) { setTimeout(watch, 500); return; }
    v.addEventListener('timeupdate', function () { if (v.currentTime >= limit) { v.pause(); end(); } });
    v.addEventListener('seeking', function () { if (v.currentTime >= limit) { v.currentTime = Math.max(0, limit - 1); v.pause(); end(); } });
  }
  watch();
  setTimeout(end, limit * 1000 + 5000);
})();
