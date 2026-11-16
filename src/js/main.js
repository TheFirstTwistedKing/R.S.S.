/* 앱 진입점: 인트로 → 메인(터미널 + 로그), 모듈 창, 잠금, 자동 잠금, 효과음 토글 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$;
  R.version = '3.1.0';
  var MODS = { files: ['ARC-01', '문서 아카이브'], graph: ['MOD-02', '관계도'], timeline: ['MOD-03', '타임라인'], security: ['MOD-04', '보안 · 백업'] };
  var destroy = null;

  /* 상단 아카이브 버튼의 문서 수 갱신 */
  R.archiveRefresh = function () {
    var d = R.store.db, el = $('#arcCount'); if (!d || !el) return;
    var c = function (t) { return d.entities.filter(function (e) { return e.type === t; }).length; };
    el.textContent = '인물 ' + c('character') + ' · 세계관 ' + (c('lore') + R.SEALED.filter(function (s) { return s.type === 'lore'; }).length) + ' · 전체 ' + (d.entities.length + R.SEALED.length);
  };

  /* 모듈 창 열기 (터미널 명령이나 모듈 안 링크에서 호출) */
  R.go = function (name, opts) {
    if (!R.store.db || !MODS[name]) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    var view = $('#view'); view.innerHTML = '';
    $('#modK').textContent = MODS[name][0]; $('#modT').textContent = MODS[name][1];
    var m = $('#module'), was = !m.hidden;
    m.hidden = false;
    if (!was) { var w = m.querySelector('.mod-win'); w.style.animation = 'none'; void w.offsetWidth; w.style.animation = ''; }
    var r = R.views[name](view, opts || {});
    if (typeof r === 'function') destroy = r;
    R.sound.nav();
  };
  function closeModule() {
    var m = $('#module'); if (m.hidden) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    m.hidden = true; $('#view').innerHTML = '';
    R.archiveRefresh();
    R.term.focus();
  }
  R.closeModule = closeModule;

  function lock() {
    if ($('#app').hidden) return;
    closeModule();
    var md = $('#modal'); md.hidden = true; md.innerHTML = '';
    R.log('SEC', '세션 잠금 · ' + R.sessionId);

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
    // 이전 버전에서 만들어진 예시 기록 정리 (한 번만 해당)
    var purged = R.purgeSamples(R.store.db);
    if (purged) { R.log('SYS', '이전 버전 예시 기록 ' + purged + '건 삭제'); R.store.save(); }
    R.logwin.render();
    R.term.boot();
    R.archiveRefresh();
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
  /* 마우스로 누를 때마다 '달칵' (터치는 제외) */
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') R.sound.click(false); }, { passive: true, capture: true });
  document.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') R.sound.click(true); }, { passive: true, capture: true });

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
    $('#archiveBtn').addEventListener('click', function () { R.go('files'); });
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
