/* CCTV 감시실 창: 아카이브처럼 따로 뜨는 창. 왼쪽은 카메라 목록, 오른쪽은 여러 대의 감시 화면(격자)
   - 화면 그리기는 scenes/outpost3/index.html?cctv=1 (한 페이지가 카메라 9대를 모두 그림)
   - 목록이나 화면 한 칸을 누르면 그 카메라만 크게, 다시 누르거나 "전체 보기" 면 격자로
   - Esc: 크게 보는 중이면 격자로, 격자면 창 닫기
   - 순찰 로봇(A-001) 발소리는 A-001 을 크게 볼 때 크게, 격자일 때 작게 */
(function () {
  'use strict';
  var R = window.RSS, h = R.h;

  /* 카메라 목록 (화면 쪽 cctv.js 와 같은 순서 · 코드) */
  R.CAMS = [
    { code: 'A-001', ko: '순찰 로봇 MK-03', en: 'Patrol unit MK-03', unit: 'MK-03' },
    { code: 'A-002', ko: '기지 전경', en: 'Base overview' },
    { code: 'A-003', ko: '연결 통로 하부', en: 'Under the walkway' },
    { code: 'A-004', ko: '동쪽 창고 · 울타리', en: 'East shed · fence' },
    { code: 'A-005', ko: '레이더 언덕', en: 'Radar hill' },
    { code: 'A-006', ko: '서쪽 골짜기', en: 'West ravine' },
    { code: 'B-001', ko: '북측 외곽 게이트', en: 'North gate', off: true },
    { code: 'B-002', ko: '보급 창고', en: 'Supply depot', off: true },
    { code: 'B-003', ko: '통신 중계소', en: 'Relay station', off: true }
  ];
  R.CAMS.forEach(function (c) { Object.defineProperty(c, 'name', { get: function () { return R.lang === 'en' ? c.en : c.ko; } }); });
  var squash = function (t) { return String(t || '').toLowerCase().replace(/[\s·\-_/>›]+/g, ''); };
  /* 입력 안에서 캠 코드 찾기 (A-001 · a001 · A 001 모두 같음) */
  R.camFind = function (q) {
    var s = squash(q);
    for (var i = 0; i < R.CAMS.length; i++) if (s.indexOf(squash(R.CAMS[i].code)) >= 0) return R.CAMS[i];
    return null;
  };

  var cur = null;   // 열려 있는 감시실 { frame, focus, setFocus }
  R.cctv = {
    isOpen: function () { return !!cur; },
    focus: function (code) { if (cur) cur.setFocus(code, true); }
  };

  R.views.cctv = function (root, opts) {
    var frame = h('iframe', { class: 'cc-frame', title: 'CCTV', src: 'scenes/outpost3/index.html?cctv=1' + (opts.cam ? '&cam=' + opts.cam : '') + (R.lang === 'en' ? '&lang=en' : '') });
    var wait = h('div', { class: 'cc-wait' }, h('b', null, 'CCTV'), h('span', null, R.T('영상 신호 수신 중', 'Acquiring video signal'), h('em', { class: 'sim-dots' }, h('i'), h('i'), h('i'))));
    var list = h('div', { class: 'list' });
    var allBtn = h('button', { class: 'btn', type: 'button', onclick: function () { setFocus(null, true); } }, R.T('전체 보기', 'All cameras'));
    var liveN = R.CAMS.filter(function (c) { return !c.off; }).length;
    var info = h('div', { class: 'cc-info' },
      h('span', null, R.T('실시간 ', 'LIVE ') , h('b', null, String(liveN))),
      h('span', null, R.T('회선 단절 ', 'OFFLINE '), h('b', null, String(R.CAMS.length - liveN))));
    var wrap = h('div', { class: 'files cctv-mod' },
      h('section', { class: 'list-pane' }, h('div', { class: 'list-tools' }, info, allBtn), list),
      h('section', { class: 'detail-pane cc-pane' }, frame, wait));
    root.appendChild(wrap);

    var focus = opts.cam || null, ready = false;
    function drawList() {
      list.innerHTML = '';
      R.CAMS.forEach(function (c) {
        list.appendChild(h('button', { class: 'item' + (c.off ? ' sealed' : '') + (focus === c.code ? ' on' : ''), type: 'button', onclick: function () { R.sound.nav(); setFocus(focus === c.code ? null : c.code, true); } },
          h('div', { class: 'thumb cc-thumb' + (c.off ? ' off' : '') }, c.off ? 'OFF' : h('span', null, h('i'), 'REC')),
          h('div', { class: 'item-t' }, c.code + '  ' + c.name),
          h('div', { class: 'item-c' }, h('span', { class: 'clr' + (c.off ? '' : ' c2') }, c.off ? 'OFFLINE' : 'LIVE')),
          h('div', { class: 'item-s' }, c.off ? R.T('회선 단절 · 신호 없음', 'Line cut · no signal') : (c.unit ? R.T('이동 카메라 · ', 'Mobile camera · ') + c.unit : R.T('고정 카메라 · 좌우 회전', 'Fixed camera · panning')))));
      });
    }
    function setFocus(code, send) {
      focus = code || null;
      drawList();
      allBtn.disabled = !focus;
      if (send && frame.contentWindow) frame.contentWindow.postMessage({ rss: 'cctv-cmd', focus: focus }, '*');
    }
    function onMsg(e) {
      if (e.source !== frame.contentWindow || !e.data) return;
      var d = e.data;
      if (d.rss === 'feed-ready' && !ready) { ready = true; wait.classList.add('gone'); R.log('SYS', R.T('CCTV 영상 수신 · 실시간 ', 'CCTV video in · live ') + liveN + R.T('대', '')); }
      else if (d.rss === 'cctv-focus') { focus = d.code; drawList(); allBtn.disabled = !focus; }
      else if (d.rss === 'cctv-esc') { if (d.focused) setFocus(null, true); else R.closeModule(); }
      else if (d.rss === 'mech-step') {
        var vol = focus === 'A-001' ? 1 : (focus ? 0 : 0.35);       // 다른 카메라를 크게 볼 때는 들리지 않음
        if (vol) R.sound.mechStep(d.side, vol);
      }
    }
    window.addEventListener('message', onMsg);
    // 영상이 20초 안에 들어오지 않으면 신호 없음 표시
    var failT = setTimeout(function () { if (!ready) { wait.classList.add('fail'); wait.lastChild.firstChild.textContent = R.T('영상 신호 없음 · 재연결 대기', 'No video signal · awaiting relink'); wait.firstChild.textContent = 'NO SIGNAL'; } }, 20000);
    setFocus(focus, false);
    cur = { frame: frame, setFocus: setFocus };
    R.log('SYS', R.T('CCTV 감시실 연결', 'CCTV room linked') + (focus ? ' · ' + focus : ''));
    return function () {
      window.removeEventListener('message', onMsg); clearTimeout(failT);
      frame.src = 'about:blank'; cur = null;
      R.log('SYS', R.T('CCTV 감시실 종료', 'CCTV room closed'));
    };
  };
})();
