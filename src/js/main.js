/* 앱 진입점: 인트로 → 메인(터미널 + 로그), 모듈 창, 잠금, 자동 잠금, 효과음 토글 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$;
  R.version = (window.rss && window.rss.version) || '';
  var MODS = { files: ['ARC-01', '문서 아카이브', 'Document archive'], graph: ['MOD-02', '관계도', 'Relation graph'], timeline: ['MOD-03', '타임라인', 'Timeline'], security: ['MOD-04', '보안 · 백업', 'Security · backup'], msg: ['MSG-01', '메신저', 'Messenger'], cctv: ['CCTV-01', 'CCTV 감시실', 'CCTV room'], economy: ['ECO-01', '경제 · 환율', 'Economy · FX'] };
  var destroy = null;

  /* 상단 아카이브 버튼의 문서 수 갱신 */
  R.archiveRefresh = function () {};   // 아카이브는 내장 문서라 갱신할 것이 없음 (호환용)


  /* 모듈 창 열기 (터미널 명령이나 모듈 안 링크에서 호출) */
  R.go = function (name, opts) {
    if (!R.store.db || !MODS[name]) return;
    if (destroy) { try { destroy(); } catch (e) {} destroy = null; }
    var view = $('#view'); view.innerHTML = '';
    $('#modK').textContent = MODS[name][0]; $('#modT').textContent = R.T(MODS[name][1], MODS[name][2]);
    $('#modHint').textContent = R.T('ESC 로 닫고 대화창으로 복귀', 'ESC to close and return');
    var m = $('#module'), was = !m.hidden;
    m.hidden = false;
    // Control 이 여는 연출: 여러 언어 글자가 쏟아진 뒤 창이 드러남
    m.classList.remove('opening'); void m.offsetWidth; m.classList.add('opening');
    R.fx.rainOpen(m.querySelector('.mod-win'));
    // 'opening' 표시는 그대로 둠: 떼면 기본 등장 애니메이션이 다시 재생되어 창이 한 번 더 깜빡임
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
    R.log('SEC', R.T('세션 잠금 · ', 'Session locked · ') + R.sessionId);
    R.fx.binary(false);

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
    if (purged) { R.log('SYS', R.T('이전 버전 예시 기록 ' + purged + '건 삭제', 'Removed ' + purged + ' legacy sample records')); R.store.save(); }
    R.logwin.render();
    R.term.boot();
    R.archiveRefresh();
    R.fx.binary(true);
    R.resetIdle();
    setTimeout(R.term.focus, 300);
  }

  /* 자동 잠금 */
  var idleT = 0;
  R.resetIdle = function () {
    clearTimeout(idleT);
    var min = R.store.db && R.store.db.settings.autoLock;
    if (min > 0) idleT = setTimeout(function () { R.log('SEC', R.T('자동 잠금 (' + min + '분 무입력)', 'Auto lock (' + min + ' min idle)')); lock(); }, min * 60000);
  };
  /* 마우스로 누를 때마다 '달칵' (터치는 제외) */
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') R.sound.click(false); }, { passive: true, capture: true });
  document.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') R.sound.click(true); }, { passive: true, capture: true });

  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!$('#app').hidden) R.resetIdle(); }, { passive: true });
  });

  /* 화면 고정 문구를 현재 언어로 */
  function applyLang() {
    var T = R.T;
    $('#langTag').textContent = R.lang === 'en' ? 'EN' : 'KO';
    $('#termIn').placeholder = T('Control 에게 말하기 · 명령어는 "도움말" · Enter 전송', 'Talk to Control · type "help" for commands · Enter to send');
    $('#lockWarn').textContent = T('본 시스템은 인가된 인원 전용입니다. 모든 접속 시도는 기록됩니다.', 'Authorized personnel only. Every access attempt is logged.');
    document.documentElement.lang = R.lang;
  }
  R.applyLang = applyLang;

  document.addEventListener('DOMContentLoaded', function () {
    if (window.rss) document.body.classList.add('electron');
    // F11 완전 전체화면: Electron 이 알려주는 상태에 맞춰 위쪽 창 버튼 자리를 없앰
    if (window.rss && window.rss.onFullscreen) window.rss.onFullscreen(function (on) { document.body.classList.toggle('fs', on); });
    else document.addEventListener('keydown', function (e) {
      // 브라우저 미리보기: F11 을 문서 전체화면으로
      if (e.key !== 'F11') return; e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {});
    });
    if (window.rss && window.rss.platform === 'win32') document.body.classList.add('win32');
    $('#topEmblem').innerHTML = window.RSSEmblem.svg({ ink: '#050607' });
    $('#modX').addEventListener('click', closeModule);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lock(); }
      if (e.key === 'Escape' && $('#modal').hidden && !$('#module').hidden) closeModule();
    });
    if (window.rss && window.rss.onFlush) window.rss.onFlush(function () { return R.store.dirty ? R.store.flush() : null; });
    window.addEventListener('beforeunload', function () { if (R.store.dirty) R.store.flush(); });
    applyLang();
    R.onLang(applyLang);
    R.fx.noise();
    R.fx.clock();
    R.intro.init();
    R.term.init();
    R.logwin.init();
    var go = function () { R.intro.show(enter); };
    if (document.fonts && document.fonts.load) {
      Promise.all(['400 14px Pretendard', '800 14px Pretendard', '14px D2Coding', '700 14px D2Coding', '22px PixelCode'].map(function (f) { return document.fonts.load(f, f.indexOf('Pixel') >= 0 ? '0123456789*' : 'Aa가'); })).then(go, go);
    } else go();
  });
  // 새 버전 알림: 인트로가 끝나 본 화면이 뜬 뒤에
  if (window.RSSUpdate) window.RSSUpdate.check({ name: 'R.S.S.', current: R.version, accent: '#FFB020', ready: function () { var a = $('#app'); return a && !a.hidden; } });
})();
