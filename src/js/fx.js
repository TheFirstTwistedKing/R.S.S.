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

  /* 창이 최소화되거나 가려지면 지구본 그리기 정지 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(globe.raf); globe.raf = 0; }
    else if (globe.on && !globe.raf) globe.raf = requestAnimationFrame(globeFrame);
    if (document.hidden) { cancelAnimationFrame(bin.raf); bin.raf = 0; }
    else if (bin.on && !bin.raf) bin.raf = requestAnimationFrame(binFrame);
  });

  /* ───────── 스캔라인 노이즈 텍스처 (한 번만 생성, 배경과 비슷한 어두운 앰버) ───────── */
  R.fx.noise = function () {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 180;
      var g = c.getContext('2d'), id = g.createImageData(180, 180);
      for (var i = 0; i < id.data.length; i += 4) {
        var v = Math.random();
        id.data[i] = 200 * v; id.data[i + 1] = 150 * v; id.data[i + 2] = 70 * v;
        id.data[i + 3] = v > 0.55 ? Math.round(60 * v) : 0;
      }
      g.putImageData(id, 0, 0);
      document.documentElement.style.setProperty('--noise-tex', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) {}
  };

  /* ───────── 메인 배경: 희미하게 흘러내리는 이진수 ───────── */
  var bin = { cv: null, g: null, raf: 0, on: false, drops: [], last: 0, fs: 14 };
  function binFrame(now) {
    if (!bin.on) { bin.raf = 0; return; }
    bin.raf = requestAnimationFrame(binFrame);
    if (now - bin.last < 50) return;          // 초당 20회만 갱신 (천천히 내려오게)
    bin.last = now;
    var cv = bin.cv, g = bin.g;
    var r = cv.getBoundingClientRect(), d = Math.min(1.5, window.devicePixelRatio || 1);
    var w = Math.round(r.width * d), hh = Math.round(r.height * d);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; bin.drops = []; }
    var fs = bin.fs * d, cols = Math.ceil(w / (fs * 1.6));
    if (bin.drops.length !== cols) { bin.drops = []; for (var i = 0; i < cols; i++) bin.drops.push({ y: Math.random() * -hh, v: 0.35 + Math.random() * 0.65, on: Math.random() < 0.55 }); }
    // 지난 글자를 조금씩 지워 꼬리가 남게
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.09)'; g.fillRect(0, 0, w, hh);
    g.globalCompositeOperation = 'source-over';
    g.font = fs + 'px D2Coding, monospace'; g.textBaseline = 'top';
    bin.drops.forEach(function (dr, i) {
      if (!dr.on) { if (Math.random() < 0.003) dr.on = true; return; }
      var x = i * fs * 1.6;
      g.fillStyle = 'rgba(255,176,32,' + (0.10 + dr.v * 0.12) + ')';
      g.fillText(Math.random() < 0.5 ? '0' : '1', x, dr.y);
      dr.y += fs * dr.v;
      if (dr.y > hh) { dr.y = -fs * (2 + Math.random() * 30); dr.v = 0.35 + Math.random() * 0.65; dr.on = Math.random() < 0.6; }
    });
  }
  R.fx.binary = function (on) {
    bin.cv = bin.cv || document.getElementById('binrain');
    bin.g = bin.g || bin.cv.getContext('2d');
    bin.on = on && !reduce;
    if (bin.on && !bin.raf) bin.raf = requestAnimationFrame(binFrame);
  };

  /* ───────── 창 열림 연출: 이진수 · 한글 · 영어 · 일본어 · 중국어 · 히브리어가 섞여 쏟아진 뒤 창이 드러남 ───────── */
  var GLYPHS = ('01010101' + '가나다라마바사아자차카타파하정보기밀' + 'ABCDEFGHKLMNRSTXZ' + 'アイウエオカキクケコサシスセソ' + '機密情報档案控制系统' + 'אבגדהוזחטיכלמנסעפצקרשת').split('');
  var openFx = { raf: 0 };
  R.fx.rainOpen = function (target, done) {
    var cv = document.getElementById('rainOpen');
    if (!cv || reduce || !target) { if (done) done(); return; }
    cancelAnimationFrame(openFx.raf);
    var rect = target.getBoundingClientRect();
    var d = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
    cv.classList.add('on');
    var g = cv.getContext('2d');
    var fs = 15, step = fs * 1.15, cols = Math.max(1, Math.floor(rect.width / step));
    var drops = [];
    for (var i = 0; i < cols; i++) drops.push({ x: rect.left + i * step + 4, y: rect.top - Math.random() * rect.height * 0.6, v: (rect.height / 26) * (0.7 + Math.random() * 0.6), trail: [] });
    var t0 = performance.now(), DUR = 760, last = 0;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.font = fs + 'px D2Coding, "Malgun Gothic", "Yu Gothic", "Microsoft YaHei", "Segoe UI", sans-serif';
    g.textBaseline = 'top';
    (function frame(now) {
      var p = (now - t0) / DUR;
      if (p >= 1) { g.clearRect(0, 0, innerWidth, innerHeight); cv.classList.remove('on'); openFx.raf = 0; return; }
      openFx.raf = requestAnimationFrame(frame);
      if (now - last < 33) return; last = now;
      g.clearRect(0, 0, innerWidth, innerHeight);
      var fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      drops.forEach(function (dr) {
        dr.y += dr.v;
        dr.trail.unshift(GLYPHS[(Math.random() * GLYPHS.length) | 0]);
        if (dr.trail.length > 9) dr.trail.pop();
        dr.trail.forEach(function (ch, k) {
          var y = dr.y - k * fs * 1.05;
          if (y < rect.top - fs || y > rect.bottom) return;
          var a = (k === 0 ? 0.95 : 0.55 * (1 - k / 9)) * fade;
          g.fillStyle = k === 0 ? 'rgba(255,236,190,' + a + ')' : 'rgba(255,176,32,' + a + ')';
          g.fillText(ch, dr.x, y);
        });
      });
    })(t0);
    R.sound.out();
    if (done) setTimeout(done, 120);
  };

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
