/* 홀로그램 · 디지털 연출: 잠금 화면 지구본, 메인 로그 창 레이더, 데이터 스트림, 시계
   모든 캔버스는 보일 때만 그리고, 창이 숨겨지면 멈춘다. */
(function () {
  'use strict';
  var R = window.RSS;
  var A = '255,176,32';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fitCanvas(cv, maxDpr) {
    var r = cv.getBoundingClientRect(), d = Math.min(maxDpr || 1.5, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, d: d };
  }

  /* ───────── 잠금 화면: 회전하는 와이어프레임 지구본 ───────── */
  var TARGETS = [
    { la: 37.5, lo: 127, n: 'TGT-01' }, { la: 51.5, lo: -0.1, n: 'TGT-02' }, { la: 38.9, lo: -77, n: 'TGT-03' },
    { la: -33.9, lo: 151.2, n: 'TGT-04' }, { la: 55.7, lo: 37.6, n: 'TGT-05' }, { la: 1.3, lo: 103.8, n: 'TGT-06' }
  ];
  var globe = { cv: null, g: null, raf: 0, on: false, t0: 0 };
  function globeFrame(now) {
    if (!globe.on) { globe.raf = 0; return; }
    globe.raf = requestAnimationFrame(globeFrame);
    var cv = globe.cv, g = globe.g, s = fitCanvas(cv, 1.5);
    var t = (now - globe.t0) / 1000;
    g.setTransform(s.d, 0, 0, s.d, 0, 0);
    g.clearRect(0, 0, s.w, s.h);
    var lock = document.querySelector('.lock');
    var lr = lock.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    var cx = lr.left - cr.left + lr.width / 2, cy = Math.min(s.h * 0.5, lr.top - cr.top + lr.height * 0.42);
    var Rr = Math.min(s.w, s.h) * (s.w > 900 ? 0.46 : 0.62);
    var rot = reduce ? 0.6 : t * 0.11, tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt);

    function proj(la, lo) {
      var a = la * Math.PI / 180, b = lo * Math.PI / 180 + rot;
      var x = Math.cos(a) * Math.cos(b), y = Math.sin(a), z = Math.cos(a) * Math.sin(b);
      return { x: cx + x * Rr, y: cy - (y * ct - z * st) * Rr, z: y * st + z * ct };
    }
    var front = new Path2D(), back = new Path2D();
    function line(pts) {
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i - 1], q = pts[i], P = (p.z + q.z) > 0 ? front : back;
        P.moveTo(p.x, p.y); P.lineTo(q.x, q.y);
      }
    }
    var la, lo, pts, k;
    for (la = -60; la <= 60; la += 20) { pts = []; for (k = 0; k <= 72; k++) pts.push(proj(la, k * 5)); line(pts); }
    for (lo = 0; lo < 360; lo += 20) { pts = []; for (k = -18; k <= 18; k++) pts.push(proj(k * 5, lo)); line(pts); }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(' + A + ',.05)'; g.stroke(back);
    g.strokeStyle = 'rgba(' + A + ',.2)'; g.stroke(front);

    // 외곽 링 + 눈금 (반대로 천천히 회전)
    g.strokeStyle = 'rgba(' + A + ',.28)';
    g.beginPath(); g.arc(cx, cy, Rr * 1.06, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    var r0 = Rr * 1.06, spin = reduce ? 0 : -t * 0.05;
    for (k = 0; k < 120; k++) {
      var an = spin + k * Math.PI / 60, len = k % 10 === 0 ? 14 : 5;
      g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
      g.lineTo(cx + Math.cos(an) * (r0 + len), cy + Math.sin(an) * (r0 + len));
    }
    g.stroke();
    // 궤도 + 위성
    g.save(); g.translate(cx, cy); g.rotate(-0.35);
    g.strokeStyle = 'rgba(' + A + ',.14)'; g.setLineDash([2, 6]);
    g.beginPath(); g.ellipse(0, 0, Rr * 1.32, Rr * 0.34, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    var sa = reduce ? 1 : t * 0.35;
    var sx = Math.cos(sa) * Rr * 1.32, sy = Math.sin(sa) * Rr * 0.34;
    g.fillStyle = 'rgba(' + A + ',.85)'; g.fillRect(sx - 3, sy - 3, 6, 6);
    g.restore();

    // 추적 대상
    g.font = '10px D2Coding, monospace'; g.textBaseline = 'middle';
    TARGETS.forEach(function (T, i) {
      var p = proj(T.la, T.lo);
      if (p.z < 0.08) return;
      var al = Math.min(1, p.z * 1.6);
      var ph = ((t * 0.5 + i * 0.37) % 1);
      g.strokeStyle = 'rgba(' + A + ',' + (0.5 * (1 - ph) * al) + ')';
      g.beginPath(); g.arc(p.x, p.y, 4 + ph * 18, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(' + A + ',' + (0.8 * al) + ')';
      var b = 7;
      g.beginPath();
      g.moveTo(p.x - b, p.y - b + 3); g.lineTo(p.x - b, p.y - b); g.lineTo(p.x - b + 3, p.y - b);
      g.moveTo(p.x + b - 3, p.y - b); g.lineTo(p.x + b, p.y - b); g.lineTo(p.x + b, p.y - b + 3);
      g.moveTo(p.x - b, p.y + b - 3); g.lineTo(p.x - b, p.y + b); g.lineTo(p.x - b + 3, p.y + b);
      g.moveTo(p.x + b - 3, p.y + b); g.lineTo(p.x + b, p.y + b); g.lineTo(p.x + b, p.y + b - 3);
      g.stroke();
      g.fillStyle = 'rgba(' + A + ',' + al + ')'; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      // 잠금 패널과 겹치는 위치나 좁은 화면에서는 이름표 생략
      var lx = lr.left - cr.left, ly = lr.top - cr.top;
      if (s.w < 700 || (p.x > lx - 180 && p.x < lx + lr.width + 10 && p.y > ly - 10 && p.y < ly + lr.height + 10)) return;
      g.fillStyle = 'rgba(243,232,210,' + (0.4 * al) + ')';
      g.fillText(T.n + '  ' + T.la.toFixed(1) + ' / ' + T.lo.toFixed(1), p.x + 12, p.y);
    });
  }
  R.fx = {};
  R.fx.globe = function (on) {
    globe.cv = globe.cv || document.getElementById('globe');
    globe.g = globe.g || globe.cv.getContext('2d');
    globe.on = on;
    if (on && !globe.raf) { globe.t0 = globe.t0 || performance.now(); globe.raf = requestAnimationFrame(globeFrame); }
  };

  /* ───────── 메인 로그 창: 보관소 레이더 (파일 = 표적) ───────── */
  var radar = { cv: null, g: null, raf: 0, on: false, t0: 0, blips: [] };
  function hash(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }
  R.fx.radarData = function () {
    var db = R.store.db; if (!db) return;
    radar.blips = db.entities.map(function (e) {
      return { a: hash(e.id) * Math.PI * 2, r: 0.25 + (3 - e.clearance) * 0.22 + hash(e.id + 'r') * 0.12, code: R.code(e), c: e.clearance, lit: 0 };
    });
    var info = document.getElementById('radarInfo');
    if (info) info.textContent = radar.blips.length + ' TARGETS · ' + db.links.length + ' LINKS';
  };
  function radarFrame(now) {
    if (!radar.on) { radar.raf = 0; return; }
    radar.raf = requestAnimationFrame(radarFrame);
    var cv = radar.cv, g = radar.g, s = fitCanvas(cv, 1.5);
    if (s.w < 10) return;
    var t = (now - radar.t0) / 1000;
    g.setTransform(s.d, 0, 0, s.d, 0, 0);
    g.clearRect(0, 0, s.w, s.h);
    var cx = s.w * 0.62, cy = s.h / 2, Rr = Math.min(s.h * 0.44, s.w * 0.34);
    g.strokeStyle = 'rgba(' + A + ',.18)'; g.lineWidth = 1;
    for (var i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, Rr * i / 4, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - Rr, cy); g.lineTo(cx + Rr, cy); g.moveTo(cx, cy - Rr); g.lineTo(cx, cy + Rr); g.stroke();
    var sweep = reduce ? 0 : (t * 1.1) % (Math.PI * 2);
    if (g.createConicGradient) {
      // 쓸고 지나간 자리의 잔광
      var tg = g.createConicGradient(sweep - 0.9, cx, cy);
      tg.addColorStop(0, 'rgba(' + A + ',0)'); tg.addColorStop(0.143, 'rgba(' + A + ',.22)'); tg.addColorStop(0.1431, 'rgba(' + A + ',0)'); tg.addColorStop(1, 'rgba(' + A + ',0)');
      g.fillStyle = tg; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Rr, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(' + A + ',.9)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sweep) * Rr, cy + Math.sin(sweep) * Rr); g.stroke();
    g.font = '9px D2Coding, monospace'; g.textBaseline = 'middle';
    radar.blips.forEach(function (b) {
      var d = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
      if (d < 0.08) b.lit = 1; else b.lit = Math.max(0, b.lit - 0.012);
      var x = cx + Math.cos(b.a) * b.r * Rr, y = cy + Math.sin(b.a) * b.r * Rr;
      var al = 0.25 + b.lit * 0.75;
      g.fillStyle = 'rgba(' + A + ',' + al + ')';
      var sz = b.c === 3 ? 5 : 3.5;
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (b.lit > 0.3) { g.fillStyle = 'rgba(243,232,210,' + (b.lit * 0.8) + ')'; g.fillText(b.code, x + 6, y); }
    });
    // 좌측 수치
    g.fillStyle = 'rgba(166,155,132,.9)'; g.font = '10px D2Coding, monospace';
    g.fillText('AZM ' + String(Math.round(sweep * 180 / Math.PI)).padStart(3, '0') + '°', 16, s.h - 34);
    g.fillText('RNG 4 RINGS · C3 CORE', 16, s.h - 18);
  }
  R.fx.radar = function (on) {
    radar.cv = radar.cv || document.getElementById('radar');
    radar.g = radar.g || radar.cv.getContext('2d');
    radar.on = on;
    if (on) { R.fx.radarData(); if (!radar.raf) { radar.t0 = radar.t0 || performance.now(); radar.raf = requestAnimationFrame(radarFrame); } }
  };

  /* 창이 최소화되거나 가려지면 모든 그리기 정지 */
  document.addEventListener('visibilitychange', function () {
    var hidden = document.hidden;
    if (hidden) { cancelAnimationFrame(globe.raf); globe.raf = 0; cancelAnimationFrame(radar.raf); radar.raf = 0; }
    else {
      if (globe.on && !globe.raf) globe.raf = requestAnimationFrame(globeFrame);
      if (radar.on && !radar.raf) radar.raf = requestAnimationFrame(radarFrame);
    }
  });

  /* 데이터 스트림 (장식용 16진수 열) */
  R.fx.hex = function () {
    var el = document.getElementById('hexStream'); if (!el || el.textContent) return;
    var hx = function (n) { var s = ''; for (var i = 0; i < n; i++) s += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2).toUpperCase() + (i < n - 1 ? ' ' : ''); return s; };
    var lines = [];
    for (var i = 0; i < 60; i++) lines.push('0x' + (0x3F00 + i * 16).toString(16).toUpperCase() + '  ' + hx(6));
    var block = lines.join('\n');
    el.textContent = block + '\n' + block;
  };

  /* 시계 */
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  R.fx.clock = function () {
    var tick = function () {
      var d = new Date(), t = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
      var a = document.getElementById('bnClock'); if (a) a.textContent = t;
      var b = document.getElementById('hudTime'); if (b) b.textContent = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + t;
      var u = document.getElementById('uptime');
      if (u && R.sessionStart) { var s = Math.floor((Date.now() - R.sessionStart) / 1000); u.textContent = p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60); }
    };
    tick(); setInterval(tick, 1000);
  };
  R.p2 = p2;
})();
