/* 캠 창: 캠 코드(예: A-001)를 입력하면 화면 오른쪽 위에 1/4 크기 감시 화면을 띄움.
   장소에 영상(feed)이 있으면 순찰 로봇 머리 카메라의 1인칭 영상을 받음 (잡음 · 녹화 표시).
   영상이 15초 안에 들어오지 않거나 영상이 없는 장소면 NO SIGNAL.
   F4: 시뮬레이션 창 전체화면 전환 */
(function () {
  'use strict';
  var R = window.RSS, h = R.h;

  /* 등록 캠. 나중에 캠을 늘리려면 여기에 추가 (code 가 입력하는 캠 코드) */
  R.CAMS = [
    { code: 'A-001', unit: 'MK-03', feed: 'scenes/outpost3/index.html?feed=1' }
  ];
  var squash = function (t) { return String(t || '').toLowerCase().replace(/[\s·\-_/>›]+/g, ''); };
  /* 입력 안에서 캠 코드 찾기 (A-001 · a001 · A 001 모두 같음) */
  R.camFind = function (q) {
    var s = squash(q);
    for (var i = 0; i < R.CAMS.length; i++) if (s.indexOf(squash(R.CAMS[i].code)) >= 0) return R.CAMS[i];
    return null;
  };
  R.camCodeIn = function (t) { return /\b[a-z]\s*-?\s*\d{3}\b/i.test(String(t || '')); };

  var el = null, cur = null, live = false, waitT = 0, noise = { raf: 0, last: 0, cv: null, g: null, img: null }, clockT = 0;

  function noiseFrame(now) {
    if (!el || live) { noise.raf = 0; return; }
    noise.raf = requestAnimationFrame(noiseFrame);
    if (now - noise.last < 70) return;          // 초당 약 14번만 갱신 (깜빡임 없이 잔잔하게)
    noise.last = now;
    var d = noise.img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = Math.random() * 70;
      d[i] = v * 1.0; d[i + 1] = v * 0.78; d[i + 2] = v * 0.5; d[i + 3] = 255;
    }
    noise.g.putImageData(noise.img, 0, 0);
  }

  function build(p) {
    var cv = h('canvas', { class: 'sim-noise', width: 288, height: 162 });
    var view = p.feed ? h('iframe', { class: 'sim-view', src: p.feed, title: 'CAM ' + p.code, tabindex: '-1', 'aria-hidden': 'true' }) : null;
    var link = h('span', { class: 'h-br' }, 'LINK 0% · ' + R.T('수신 대기', 'AWAITING'));
    var clock = h('span', { class: 'sim-clock' });
    var root = h('section', { class: 'sim', role: 'dialog', 'aria-label': 'Camera ' + p.code },
      h('div', { class: 'win-h sim-h' },
        h('span', { class: 'win-k' }, 'CAM'),
        h('span', { class: 'win-t' }, p.code),
        h('span', { class: 'win-s' }, p.unit + ' · ' + R.T('순찰 로봇', 'PATROL UNIT')),
        h('button', { class: 'mod-x sim-btn', type: 'button', title: 'F4', onclick: function () { R.sim.toggleFull(); } }, 'F4 ' + R.T('전체화면', 'FULL')),
        h('button', { class: 'mod-x sim-btn', type: 'button', 'aria-label': R.T('닫기', 'Close'), onclick: function () { R.sim.close(true); } }, '✕')),
      h('div', { class: 'sim-feed' },
        view,
        cv,
        h('div', { class: 'sim-scan' }),
        h('div', { class: 'sim-hud' },
          h('span', { class: 'h-tl' }, 'CAM ' + p.code),
          h('span', { class: 'h-tr' }, h('i', { class: 'sim-rec' }), clock),
          link),
        h('div', { class: 'sim-corners' }, h('i'), h('i'), h('i'), h('i')),
        h('div', { class: 'sim-nosig' },
          h('b', null, 'NO SIGNAL'),
          h('span', { class: 'sim-msg' }, p.feed ? R.T('영상 신호 수신 중', 'Acquiring video signal') : R.T('영상 신호 없음 · 재연결 대기', 'No video signal · awaiting relink'), h('em', { class: 'sim-dots' }, h('i'), h('i'), h('i'))))));
    root._link = link;
    noise.cv = cv; noise.g = cv.getContext('2d'); noise.img = noise.g.createImageData(288, 162);
    var tick = function () { var d = new Date(); clock.textContent = d.getFullYear() + '-' + R.p2(d.getMonth() + 1) + '-' + R.p2(d.getDate()) + ' ' + R.p2(d.getHours()) + ':' + R.p2(d.getMinutes()) + ':' + R.p2(d.getSeconds()); };
    tick(); clockT = setInterval(tick, 1000);
    return root;
  }

  R.sim = {
    isOpen: function () { return !!el; },
    open: function (p) {
      if (el) R.sim.close(false);
      cur = p;
      el = build(p);
      document.getElementById('app').appendChild(el);
      R.win.make(el, el.querySelector('.sim-h'), function () { R.sim.toggleFull(); });
      // Control 이 여는 연출: 글자 비가 쏟아진 뒤 화면이 켜짐(가로선 → 화면) → NO SIGNAL
      el.classList.add('opening');
      R.fx.rainOpen(el);
      setTimeout(function () { if (el) el.classList.add('sim-live'); }, 380);
      if (!noise.raf) noise.raf = requestAnimationFrame(noiseFrame);
      live = false;
      clearTimeout(waitT);
      if (p.feed) waitT = setTimeout(function () { if (el && !live) lost(); }, 15000);
      else lost();
      R.log('SYS', R.T('캠 연결 ', 'Camera link ') + p.code + (p.feed ? R.T(' · 영상 요청', ' · requesting video') : R.T(' · 신호 없음', ' · no signal')));
    },
    close: function (byUser) {
      if (!el) return;
      clearInterval(clockT); clearTimeout(waitT); live = false;
      cancelAnimationFrame(noise.raf); noise.raf = 0;
      el.remove(); el = null;
      if (byUser && cur) R.log('SYS', R.T('캠 종료 ', 'Camera closed ') + cur.code);
      cur = null;
      if (R.term) R.term.focus();
    },
    toggleFull: function () {
      if (!el) return false;
      el.classList.toggle('full');
      R.sound.out();
      return true;
    }
  };

  /* 영상이 들어옴: NO SIGNAL 을 걷고 잡음은 아주 옅게 · 녹화 표시 켬 */
  function onLive() {
    if (!el || live) return;
    live = true; clearTimeout(waitT);
    el.classList.add('sim-feed-on');
    // NO SIGNAL · 화면 잡음 · 겹 주사선을 걷어냄 (영상 쪽에 잡음과 주사선이 따로 있음)
    ['.sim-nosig', '.sim-noise', '.sim-scan'].forEach(function (q) { var x = el.querySelector(q); if (x) x.remove(); });
    cancelAnimationFrame(noise.raf); noise.raf = 0;
    el._link.textContent = 'LINK 100% · ' + R.T('수신 양호', 'SIGNAL OK');
    R.log('SYS', R.T('영상 수신 ', 'Video in ') + cur.code + ' · ' + cur.unit);
  }
  /* 영상이 안 들어옴: NO SIGNAL 유지 */
  function lost() {
    if (!el) return;
    var v = el.querySelector('.sim-view'); if (v) v.remove();
    var m = el.querySelector('.sim-msg'); if (m) m.firstChild.textContent = R.T('영상 신호 없음 · 재연결 대기', 'No video signal · awaiting relink');
    el._link.textContent = 'LINK 0% · ' + R.T('수신 없음', 'NO CARRIER');
  }
  window.addEventListener('message', function (e) {
    var v = el && el.querySelector('.sim-view');
    if (!v || e.source !== v.contentWindow || !e.data) return;
    if (e.data.rss === 'feed-ready') onLive();
    else if (e.data.rss === 'mech-step' && live) R.sound.mechStep(e.data.side);
  });

  /* F4: 시뮬레이션 전체화면 전환 · Esc: 전체화면이면 원래 크기로 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F4' && !e.altKey) { if (R.sim.toggleFull()) e.preventDefault(); }
    else if (e.key === 'Escape' && el && el.classList.contains('full')) { el.classList.remove('full'); e.stopPropagation(); }
  }, true);
})();
