/* 앱 진입점: 인트로 → 메인(터미널 + 로그), 모듈 창, 잠금, 자동 잠금, 효과음 토글 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$;
  R.version = '3.0.0';
  var MODS = { files: ['MOD-01', '파일 열람 · 편집'], graph: ['MOD-02', '관계도'], timeline: ['MOD-03', '타임라인'], security: ['MOD-04', '보안 · 백업'] };
  var destroy = null;

  /* 모듈 창 열기 (터미널 명령이나 모듈 안 링크에서 호출) */
  R.go = function (name, opts) {
    if (!R.store.db || !MODS[name]) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    var view = $('#view'); view.innerHTML = '';
    $('#modK').textContent = MODS[name][0]; $('#modT').textContent = MODS[name][1];
    var m = $('#module'), was = !m.hidden;
    m.hidden = false;
    R.fx.radar(false); // 모듈이 화면을 덮는 동안 뒤의 레이더는 정지
    if (!was) { var w = m.querySelector('.mod-win'); w.style.animation = 'none'; void w.offsetWidth; w.style.animation = ''; }
    var r = R.views[name](view, opts || {});
    if (typeof r === 'function') destroy = r;
    R.sound.nav();
  };
  function closeModule() {
    var m = $('#module'); if (m.hidden) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    m.hidden = true; $('#view').innerHTML = '';
    R.fx.radar(true);
    R.term.focus();
  }
  R.closeModule = closeModule;

  function lock() {
    if ($('#app').hidden) return;
    closeModule();
    var md = $('#modal'); md.hidden = true; md.innerHTML = '';
    R.log('SEC', '세션 잠금 · ' + R.sessionId);
    R.fx.radar(false);
    R.store.lock().then(function () {
      $('#termOut').innerHTML = ''; $('#logList').innerHTML = '';
      $('#app').hidden = true;
      R.intro.show(enter);
    });
  }
  R.lock = lock;

  function enter() {
    R.sessionId = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(3))).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase();
    R.sessionStart = Date.now();
    $('#sessId').textContent = R.sessionId;
    var app = $('#app');
    app.hidden = false; app.classList.remove('on'); void app.offsetWidth; app.classList.add('on');
    setTimeout(function () { app.classList.remove('on'); }, 1400);
    R.logwin.render();
    R.term.boot();
    R.fx.radar(true);
    R.resetIdle();
    setTimeout(R.term.focus, 300);
  }

  /* 자동 잠금 */
  var idleT = 0;
  R.resetIdle = function () {
    clearTimeout(idleT);
    var min = R.store.db && R.store.db.settings.autoLock;
    if (min > 0) idleT = setTimeout(function () { R.log('SEC', '자동 잠금 (' + min + '분 무입력)'); lock(); }, min * 60000);
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
    if (window.rss) document.body.classList.add('electron');
    if (window.rss && window.rss.platform === 'win32') document.body.classList.add('win32');
    $('#topEmblem').innerHTML = window.RSSEmblem.svg({ ink: '#050607' });
    $('#soundBtn').addEventListener('click', function () { R.sound.set(!R.sound.on); drawSound(); R.sound.key(); R.term.focus(); });
    $('#lockBtn').addEventListener('click', lock);
    $('#modX').addEventListener('click', closeModule);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lock(); }
      if (e.key === 'Escape' && $('#modal').hidden && !$('#module').hidden) closeModule();
    });
    if (window.rss && window.rss.onFlush) window.rss.onFlush(function () { return R.store.dirty ? R.store.flush() : null; });
    window.addEventListener('beforeunload', function () { if (R.store.dirty) R.store.flush(); });
    drawSound();
    R.fx.clock();
    R.intro.init();
    R.term.init();
    R.logwin.init();
    var go = function () { R.intro.show(enter); };
    if (document.fonts && document.fonts.load) {
      Promise.all(['400 14px Pretendard', '800 14px Pretendard', '14px D2Coding', '700 14px D2Coding', '22px PixelCode'].map(function (f) { return document.fonts.load(f, f.indexOf('Pixel') >= 0 ? '0123456789*' : 'Aa가'); })).then(go, go);
    } else go();
  });
})();
