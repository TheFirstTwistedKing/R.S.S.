/* CCTV 감시실 화면 (cctv=1): 카메라 여러 대를 격자로 보여 주고, 한 칸을 누르면 크게 봄
   - WebGL 은 하나만 쓰고, 카메라마다 한 번씩 그려서 각 칸(2D 캔버스)에 복사함
   - 격자: 순찰 로봇(A-001)은 매 프레임, 고정 카메라는 돌아가며 한 대씩 (실제 CCTV 처럼 끊기는 프레임)
   - 크게 보기: 고른 카메라 하나만 큰 해상도로 매 프레임
   - 회선 끊긴 카메라(B-)는 잡음 + NO SIGNAL */
(function () {
  'use strict';
  var T = window.THREE, S = window.__scene;
  if (!S || !S.CCTV) return;
  document.body.classList.add('cctv');
  var H = S.height;

  /* ── 카메라 목록 ── pos: 위치, at: 보는 곳, fov, pan: 좌우로 천천히 도는 폭(라디안) */
  var CAMS = [
    { code: 'A-001', ko: '순찰 로봇 MK-03', en: 'Patrol unit MK-03', robot: true },
    { code: 'A-002', ko: '기지 전경', en: 'Base overview', pos: [-0.8, 22.2, 58.7], at: [6.2, 6, -9.5], fov: 44, pan: 0.1 },
    { code: 'A-003', ko: '연결 통로 하부', en: 'Under the walkway', pos: [3.5, 6.2, 14], at: [4, 2.5, -9], fov: 62, pan: 0.18 },
    { code: 'A-004', ko: '동쪽 창고 · 울타리', en: 'East shed · fence', pos: [24, 7.5, 9], at: [42, 2, -8], fov: 52, pan: 0.16 },
    { code: 'A-005', ko: '레이더 언덕', en: 'Radar hill', pos: [26, 11, 6], at: [70, 0, -112], fov: 16, pan: 0.05, atGround: 6 },
    { code: 'A-006', ko: '서쪽 골짜기', en: 'West ravine', pos: [-26, 9.5, 6], at: [-60, -8, -62], fov: 56, pan: 0.14 },
    { code: 'B-001', ko: '북측 외곽 게이트', en: 'North gate', off: true },
    { code: 'B-002', ko: '보급 창고', en: 'Supply depot', off: true },
    { code: 'B-003', ko: '통신 중계소', en: 'Relay station', off: true }
  ];
  var lang = /[?&]lang=en/.test(location.search) ? 'en' : 'ko';
  var name = function (c) { return lang === 'en' ? c.en : c.ko; };

  var RW = 640, RH = 360, BIG_W = 1280, BIG_H = 720, size = '';
  function useSize(w, h) { var k = w + 'x' + h; if (k !== size) { size = k; S.setRenderSize(w, h); } }

  // 카메라 만들기
  CAMS.forEach(function (c) {
    if (c.off) return;
    c.cam = new T.PerspectiveCamera(c.robot ? 68 : c.fov, 16 / 9, c.robot ? 0.15 : 0.5, 900);
    if (c.robot) { S.fpvCam = c.cam; return; }
    c.cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
    c.target = new T.Vector3(c.at[0], c.atGround != null ? H(c.at[0], c.at[2]) + c.atGround : c.at[1], c.at[2]);
    c.base = Math.atan2(c.target.x - c.pos[0], c.target.z - c.pos[2]);
    c.dist = Math.hypot(c.target.x - c.pos[0], c.target.z - c.pos[2]);
    c.ph = Math.random() * 6;
  });
  function aim(c, t) {
    // 감시 카메라처럼 좌우로 천천히 왕복 (끝에서 잠깐 멈춤)
    var s = Math.sin(t * 0.06 + c.ph), a = c.base + c.pan * Math.max(-1, Math.min(1, s * 1.25));
    c.cam.lookAt(c.pos[0] + Math.sin(a) * c.dist, c.target.y, c.pos[2] + Math.cos(a) * c.dist);
  }

  /* ── 화면 칸 만들기 ── */
  var grid = document.createElement('div'); grid.id = 'grid';
  document.body.appendChild(grid);
  var clockEls = [];
  CAMS.forEach(function (c, i) {
    var el = document.createElement('div');
    el.className = 'tile' + (c.off ? ' off' : '');
    el.innerHTML = '<canvas></canvas><div class="t-hud"><span class="t-code"><b>' + c.code + '</b> ' + name(c) + '</span>' +
      '<span class="t-rec">' + (c.off ? 'OFFLINE' : '<i></i>REC') + '</span><span class="t-time"></span>' +
      (c.off ? '<span class="t-ns"><b>NO SIGNAL</b>' + (lang === 'en' ? 'Line cut' : '회선 단절') + '</span>' : '') + '</div>';
    el.addEventListener('click', function () { focus(focused === c ? null : c); });
    grid.appendChild(el);
    c.el = el; c.cv = el.querySelector('canvas'); c.g = c.cv.getContext('2d');
    clockEls.push(el.querySelector('.t-time'));
    if (c.off) { c.cv.width = 160; c.cv.height = 90; c.noise = c.g.createImageData(160, 90); }
  });

  /* ── 크게 보기 ── */
  var focused = null;
  function focus(c) {
    focused = c && !c.off ? c : (c && c.off ? c : null);
    grid.classList.toggle('one', !!focused);
    CAMS.forEach(function (x) { x.el.classList.toggle('on', x === focused); });
    document.body.classList.toggle('fpv', !!(focused && focused.robot));
    if (window.parent !== window) window.parent.postMessage({ rss: 'cctv-focus', code: focused ? focused.code : null }, '*');
    fit();
  }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.rss !== 'cctv-cmd') return;
    if (d.focus === null) focus(null);
    else { var c = CAMS.filter(function (x) { return x.code === d.focus; })[0]; if (c) focus(c); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage({ rss: 'cctv-esc', focused: !!focused }, '*');
  });

  /* 칸 캔버스 크기를 화면 크기에 맞춤 */
  function fit() {
    CAMS.forEach(function (c) {
      if (c.off) return;
      var r = c.cv.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(16, Math.round(r.width * k)), h = Math.max(9, Math.round(r.height * k));
      if (c.cv.width !== w || c.cv.height !== h) { c.cv.width = w; c.cv.height = h; c.dirty = true; }
    });
  }
  addEventListener('resize', fit);
  setTimeout(fit, 0);

  /* ── 그리기 ── */
  var turn = 0, noiseT = 0;
  function copy(c) {
    var src = S.renderer.domElement, w = c.cv.width, h = c.cv.height;
    // 칸 비율에 맞춰 가운데를 잘라 채움
    var sw = src.width, sh = src.height, k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
    c.g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  function draw(c, t, big) {
    if (!c.robot) aim(c, t);
    var r = c.cv.getBoundingClientRect(), asp = r.width && r.height ? r.width / r.height : 16 / 9;
    c.cam.aspect = asp; c.cam.updateProjectionMatrix();
    if (big) useSize(BIG_W, Math.round(BIG_W / asp)); else useSize(RW, Math.round(RW / asp));
    S.grade.uniforms.time.value = t + c.code.charCodeAt(4);       // 칸마다 잡음 무늬가 달라지게
    S.renderView(c.cam);
    copy(c);
  }
  function noiseTiles(now) {
    if (now - noiseT < 80) return;                                  // 잡음은 초당 12번만 (깜빡임 없이 잔잔하게)
    noiseT = now;
    CAMS.forEach(function (c) {
      if (!c.off || (focused && focused !== c)) return;
      var d = c.noise.data;
      for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 64; d[i] = v; d[i + 1] = v * 0.86; d[i + 2] = v * 0.7; d[i + 3] = 255; }
      c.g.putImageData(c.noise, 0, 0);
    });
  }
  var live = CAMS.filter(function (c) { return !c.off; }), fixed = live.filter(function (c) { return !c.robot; }), ready = false;
  window.__cctvRender = function (dt, t) {
    var now = performance.now();
    if (focused && !focused.off) draw(focused, t, true);
    else if (!focused) {
      draw(live[0], t, false);                                     // 로봇은 매 프레임
      var c = fixed[turn++ % fixed.length];                        // 고정 카메라는 돌아가며 한 대씩
      draw(c, t, false);
    }
    // 준비 완료: 격자는 모든 칸이 한 번씩 그려진 뒤, 크게 보기는 첫 화면이 그려진 뒤 (회선 단절 칸은 바로)
    if (!ready && (focused || turn > fixed.length)) {
      ready = true;
      if (window.parent !== window) window.parent.postMessage({ rss: 'feed-ready' }, '*');
    }
    noiseTiles(now);
    // 시각 표시는 1초에 한 번
    if (now - (window.__cctvClk || 0) > 500) {
      window.__cctvClk = now;
      var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
      var s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
      clockEls.forEach(function (e) { e.textContent = s; });
    }
  };
  // 시작할 때 고른 카메라 (?cam=A-001)
  var pre = (location.search.match(/[?&]cam=([A-Z]-\d{3})/i) || [])[1];
  if (pre) setTimeout(function () { var c = CAMS.filter(function (x) { return x.code === pre.toUpperCase(); })[0]; if (c) focus(c); }, 0);
  window.__cctv = { CAMS: CAMS, focus: focus };
})();
