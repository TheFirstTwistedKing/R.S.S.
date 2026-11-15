/* 앱 진입점: 인트로 → 메인, 화면 전환, 잠금, 자동 잠금, 효과음 토글 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$;
  R.version = '1.0.0';
  var NAMES = { files: ['01', '파일'], graph: ['02', '관계도'], timeline: ['03', '타임라인'], security: ['04', '보안·백업'] };
  var current = null, destroy = null;

  R.go = function (name, opts) {
    if (!R.store.db) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    var view = $('#view'); view.innerHTML = '';
    current = name;
    R.$$('.nav').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === name); });
    $('#crumbK').textContent = NAMES[name][0]; $('#crumbT').textContent = NAMES[name][1];
    var r = R.views[name](view, opts || {});
    if (typeof r === 'function') destroy = r;
  };

  function lock() {
    if ($('#app').hidden) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    var m = $('#modal'); m.hidden = true; m.innerHTML = '';
    R.store.lock().then(function () {
      $('#view').innerHTML = '';
      $('#app').hidden = true;
      R.intro.show(enter);
    });
  }
  R.lock = lock;

  function enter() {
    $('#app').hidden = false;
    R.go(current || 'files');
    R.resetIdle();
  }

  /* 자동 잠금 */
  var idleT = 0;
  R.resetIdle = function () {
    clearTimeout(idleT);
    var min = R.store.db && R.store.db.settings.autoLock;
    if (min > 0) idleT = setTimeout(lock, min * 60000);
  };
  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!$('#app').hidden) R.resetIdle(); }, { passive: true });
  });

  /* 효과음 토글: 메인 화면 상단에만 존재 */
  function drawSound() {
    var b = $('#soundBtn');
    b.setAttribute('aria-pressed', R.sound.on ? 'true' : 'false');
    b.querySelector('b').textContent = R.sound.on ? 'ON' : 'OFF';
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#railEmblem').innerHTML = window.RSSEmblem.svg({ cell: 2 });
    R.$$('.nav').forEach(function (b) {
      b.addEventListener('click', function () { R.sound.nav(); R.go(b.getAttribute('data-view')); });
    });
    $('#soundBtn').addEventListener('click', function () { R.sound.set(!R.sound.on); drawSound(); R.sound.key(); });
    $('#lockBtn').addEventListener('click', lock);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lock(); }
    });
    if (window.rss && window.rss.onFlush) window.rss.onFlush(function () { return R.store.dirty ? R.store.flush() : null; });
    window.addEventListener('beforeunload', function () { if (R.store.dirty) R.store.flush(); });
    drawSound();
    R.intro.init();
    var go = function () { R.intro.show(enter); };
    if (document.fonts && document.fonts.load) {
      Promise.all(['11px G11', '11px G11B', '14px G14', '11px GM11'].map(function (f) { return document.fonts.load(f); })).then(go, go);
    } else go();
  });
})();
