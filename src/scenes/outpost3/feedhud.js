/* CCTV A-001(순찰 로봇)을 크게 볼 때 HUD: 방위 눈금 · 타임코드 · 속도 · 좌표 · 고도 */
(function () {
  'use strict';
  if (!/[?&]cctv=1/.test(location.search)) return;
  var q = function (s) { return document.querySelector(s); };
  var tapeIn = q('.tape-in'), hdg = q('.hdg'), tc = q('.tc'), spd = q('.spd'), grid = q('.grid'), elv = q('.elv');
  var STEP = 40;                                  // 15° 마다 눈금, 눈금 사이 40px
  var names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  var html = '';
  for (var d = -360; d <= 720; d += 15) {
    var a = ((d % 360) + 360) % 360;
    html += '<span style="left:' + ((d + 360) / 15 * STEP) + 'px">' + (names[a] || a) + '</span>';
  }
  tapeIn.innerHTML = html;
  var t0 = performance.now(), last = 0;
  var pad = function (n, w) { n = String(Math.abs(Math.round(n))); while (n.length < w) n = '0' + n; return n; };
  window.__feedHud = function (s) {
    var now = performance.now();
    if (now - last < 50) return;                 // 화면 글자는 초당 20번만 갱신
    last = now;
    var h = s.heading, w = tapeIn.parentNode.clientWidth;
    tapeIn.style.transform = 'translateX(' + (w / 2 - (h + 360) / 15 * STEP) + 'px)';
    hdg.textContent = pad(h, 3) + '°';
    var e = (now - t0) / 1000, fr = Math.floor((e % 1) * 30);
    tc.textContent = pad(Math.floor(e / 3600), 2) + ':' + pad(Math.floor(e / 60) % 60, 2) + ':' + pad(Math.floor(e) % 60, 2) + ':' + pad(fr, 2);
    spd.textContent = s.speed.toFixed(1);
    grid.textContent = (s.x < 0 ? '-' : '+') + pad(s.x * 10, 3) + ' / ' + (s.z < 0 ? '-' : '+') + pad(s.z * 10, 3);
    elv.textContent = (1240 + s.alt * 2).toFixed(1);
  };
})();
