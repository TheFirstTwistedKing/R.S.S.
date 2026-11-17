/* 일하기: R.S.S. 장치 활성화
   - 전선 10개(왼쪽, 잡아당기는 쪽)와 연결부 10개(오른쪽)를 색과 도형 문양이 모두 같은 것끼리 연결
     (같은 색이 두 개씩, 같은 도형도 두 개씩 있어서 색과 도형을 둘 다 봐야 함)
   - 10개를 모두 연결하면 톱니바퀴가 켜지고, 톱니바퀴를 손가락으로 두 바퀴 돌리면 장치 활성화
   - 활성화하면 50,000,000 LEVC 지급. 하루 한 번 (이 휴대폰 시각 기준 오전 12:00 에 다시 열림) */
(function () {
  'use strict';
  var M = window.RSSM, h = M.h, NS = 'http://www.w3.org/2000/svg';
  var PAY = 50000000, TURNS = 2;
  var COLORS = [['#E0412B', '빨강'], ['#FFB020', '주황'], ['#3FB37F', '초록'], ['#3D8BE0', '파랑'], ['#A46BE8', '보라']];
  var SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star'];
  // 색 i 는 도형 i 와 도형 i+2 에 한 번씩 → 같은 색 2개 · 같은 도형 2개
  var PAIRS = [];
  COLORS.forEach(function (c, i) { PAIRS.push({ c: i, s: i }); PAIRS.push({ c: i, s: (i + 2) % 5 }); });

  function el(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
  function shape(kind, r, fill, stroke) {
    var a = { fill: fill || 'none', stroke: stroke || 'none', 'stroke-width': 2, 'stroke-linejoin': 'round' }, p;
    if (kind === 'circle') { a.r = r; return el('circle', a); }
    if (kind === 'square') { a.x = -r * 0.85; a.y = -r * 0.85; a.width = r * 1.7; a.height = r * 1.7; return el('rect', a); }
    if (kind === 'triangle') p = [[0, -r], [r * 0.95, r * 0.75], [-r * 0.95, r * 0.75]];
    else if (kind === 'diamond') p = [[0, -r * 1.1], [r, 0], [0, r * 1.1], [-r, 0]];
    else { p = []; for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r * 1.1, an = -Math.PI / 2 + i * Math.PI / 5; p.push([Math.cos(an) * rr, Math.sin(an) * rr]); } }
    a.points = p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    return el('polygon', a);
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* 오늘 이미 했는지 · 다음 가능 시각 (오늘 자정) */
  function doneToday(d) { return d.work && d.work.day === M.day(); }
  function untilMidnight() { var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0); return m - n; }
  function hhmmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return M.p2(Math.floor(s / 3600)) + ':' + M.p2(Math.floor(s / 60) % 60) + ':' + M.p2(s % 60); }

  M.work = function (root, data, onPay) {
    var W = 360, ROW = 37, TOP = 18, H = TOP + ROW * 10 + 128, LX = 44, RX = W - 44;   // 휴대폰 한 화면에 판 전체가 들어오게
    var done = doneToday(data);
    var info = h('div', { class: 'wk-info' });
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'wk-board' });
    var wires = el('g'), lplugs = el('g'), rsock = el('g');
    svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#wkbg)' }));
    var defs = el('defs');
    defs.innerHTML = '<pattern id="wkbg" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="rgba(255,176,32,.06)"/></pattern>' +
      '<filter id="wkglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg.appendChild(defs);
    // 양쪽 단자대
    svg.appendChild(el('rect', { x: 18, y: TOP - 6, width: 52, height: ROW * 10 + 12, fill: '#0B0C0E', stroke: 'rgba(255,176,32,.34)' }));
    svg.appendChild(el('rect', { x: W - 70, y: TOP - 6, width: 52, height: ROW * 10 + 12, fill: '#0B0C0E', stroke: 'rgba(255,176,32,.34)' }));
    svg.appendChild(wires); svg.appendChild(lplugs); svg.appendChild(rsock);

    var left = shuffle(PAIRS), right = shuffle(PAIRS), linked = 0;
    var plugs = left.map(function (p, i) {
      var y = TOP + i * ROW + ROW / 2, g = el('g', { transform: 'translate(' + LX + ',' + y + ')', class: 'wk-plug' });
      g.appendChild(el('circle', { r: 14.5, fill: COLORS[p.c][0] }));
      g.appendChild(shape(SHAPES[p.s], 7, '#111214'));
      g.appendChild(el('circle', { r: 18, fill: 'transparent' }));            // 손가락으로 잡기 쉽게 넓은 영역
      lplugs.appendChild(g);
      return { p: p, x: LX, y: y, g: g, linked: false };
    });
    var socks = right.map(function (p, i) {
      var y = TOP + i * ROW + ROW / 2, g = el('g', { transform: 'translate(' + RX + ',' + y + ')' });
      g.appendChild(el('circle', { r: 14.5, fill: '#07080A', stroke: COLORS[p.c][0], 'stroke-width': 2.5 }));
      g.appendChild(shape(SHAPES[p.s], 7, 'none', COLORS[p.c][0]));
      rsock.appendChild(g);
      return { p: p, x: RX, y: y, g: g, used: false };
    });
    function wirePath(x1, y1, x2, y2) { var mx = (x1 + x2) / 2; return 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2; }

    // 톱니바퀴
    var GX = W / 2, GY = TOP + ROW * 10 + 58, gear = el('g', { transform: 'translate(' + GX + ',' + GY + ') scale(.78)', class: 'wk-gear off' });
    var teeth = el('g'), d = '';
    for (var i = 0; i < 12; i++) { var a0 = i / 12 * Math.PI * 2; var c = Math.cos, s = Math.sin, R1 = 44, R2 = 56, w = 0.13; d += 'M' + (c(a0 - w) * R1) + ' ' + (s(a0 - w) * R1) + 'L' + (c(a0 - w * 0.6) * R2) + ' ' + (s(a0 - w * 0.6) * R2) + 'L' + (c(a0 + w * 0.6) * R2) + ' ' + (s(a0 + w * 0.6) * R2) + 'L' + (c(a0 + w) * R1) + ' ' + (s(a0 + w) * R1) + 'Z'; }
    teeth.appendChild(el('path', { d: d, fill: 'currentColor' }));
    teeth.appendChild(el('circle', { r: 46, fill: 'currentColor' }));
    teeth.appendChild(el('circle', { r: 30, fill: '#07080A' }));
    for (var k = 0; k < 6; k++) teeth.appendChild(el('rect', { x: -3, y: -30, width: 6, height: 24, fill: 'currentColor', transform: 'rotate(' + (k * 60) + ')' }));
    teeth.appendChild(el('circle', { r: 9, fill: 'currentColor' }));
    var ring = el('circle', { r: 66, fill: 'none', stroke: 'rgba(255,176,32,.25)', 'stroke-width': 3, 'stroke-dasharray': '414.7', 'stroke-dashoffset': '414.7', transform: 'rotate(-90)', class: 'wk-ring' });
    gear.appendChild(ring); gear.appendChild(teeth);
    svg.appendChild(gear);
    var gearLabel = el('text', { x: GX, y: GY + 64, 'text-anchor': 'middle', class: 'wk-glabel' }); gearLabel.textContent = '전선을 모두 연결하십시오';
    svg.appendChild(gearLabel);

    root.appendChild(h('div', { class: 'wk' }, info, h('div', { class: 'wk-wrap' }, svg)));

    function pt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }

    /* 전선 끌기 */
    var drag = null;
    plugs.forEach(function (pl) {
      pl.g.addEventListener('pointerdown', function (e) {
        if (pl.linked || done || drag) return;
        e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch (_) {}
        var path = el('path', { d: '', stroke: COLORS[pl.p.c][0], 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' });
        wires.appendChild(path);
        drag = { pl: pl, path: path };
        M.sound.zap();
      });
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pt(e); drag.path.setAttribute('d', wirePath(drag.pl.x + 14, drag.pl.y, p.x, p.y));
    });
    function endDrag(e) {
      if (!drag) return;
      var p = pt(e), pl = drag.pl, best = null, bd = 24;
      socks.forEach(function (s) { var dd = Math.hypot(s.x - p.x, s.y - p.y); if (!s.used && dd < bd) { bd = dd; best = s; } });
      if (best && best.p.c === pl.p.c && best.p.s === pl.p.s) {
        best.used = true; pl.linked = true; linked++;
        drag.path.setAttribute('d', wirePath(pl.x + 14, pl.y, best.x - 14, best.y));
        drag.path.setAttribute('class', 'wk-wire');
        best.g.firstChild.setAttribute('fill', COLORS[pl.p.c][0]); best.g.lastChild.setAttribute('stroke', '#111214');
        pl.g.classList.add('linked');
        M.sound.plug();
        status();
      } else {
        // 틀린 곳: 전선이 되돌아감
        var path = drag.path; path.classList.add('wk-back');
        if (best) { M.sound.deny(); M.toast('색과 도형 문양이 모두 같은 곳에 연결하십시오'); }
        setTimeout(function () { path.remove(); }, 220);
      }
      drag = null;
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    /* 톱니바퀴 돌리기 */
    var spin = 0, last = null, turning = false, lastTick = 0;
    gear.addEventListener('pointerdown', function (e) {
      if (done || linked < 10) return;
      e.preventDefault(); e.stopPropagation();
      try { gear.setPointerCapture(e.pointerId); } catch (_) {}
      var p = pt(e); last = Math.atan2(p.y - GY, p.x - GX); turning = true;
    });
    gear.addEventListener('pointermove', function (e) {
      if (!turning) return;
      var p = pt(e), a = Math.atan2(p.y - GY, p.x - GX), da = a - last;
      if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      last = a; spin = Math.max(0, spin + da);                                // 한쪽(시계 방향)으로 돌려야 쌓임
      var deg = spin * 180 / Math.PI;
      teeth.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ')');
      ring.setAttribute('stroke-dashoffset', (414.7 * (1 - Math.min(1, deg / (360 * TURNS)))).toFixed(1));
      if (Math.floor(deg / 30) !== lastTick) { lastTick = Math.floor(deg / 30); M.sound.gear(); }
      if (deg >= 360 * TURNS) { turning = false; activate(); }
    });
    gear.addEventListener('pointerup', function () { turning = false; });
    gear.addEventListener('pointercancel', function () { turning = false; });

    function activate() {
      done = true;
      data.work = { day: M.day() };
      gear.classList.add('on'); svg.classList.add('powered');
      gearLabel.textContent = '장치 활성화 완료';
      M.sound.power();
      onPay(PAY);
      status();
    }

    var cdT = 0;
    function status() {
      clearInterval(cdT);
      info.innerHTML = '';
      if (done) {
        var cd = h('b', { class: 'wk-cd' });
        info.appendChild(h('div', { class: 'wk-h' }, h('span', { class: 'wk-k' }, 'DEVICE'), h('span', null, '오늘 활성화 완료'), cd));
        info.appendChild(h('p', null, '다음 작업은 오전 12:00 (자정) 이후에 열립니다'));
        var tick = function () { var ms = untilMidnight(); cd.textContent = hhmmss(ms); if (!doneToday(data)) { clearInterval(cdT); M.toast('새 작업이 열렸습니다'); M.workReset && M.workReset(); } };
        tick(); cdT = setInterval(tick, 1000);
        if (!svg.classList.contains('powered')) {
          // 이미 한 날: 완성된 상태로만 보여 줌
          plugs.forEach(function (pl, i) { var s = socks.filter(function (x) { return x.p.c === pl.p.c && x.p.s === pl.p.s; })[0]; s.used = true; pl.linked = true;
            wires.appendChild(el('path', { d: wirePath(pl.x + 14, pl.y, s.x - 14, s.y), stroke: COLORS[pl.p.c][0], 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round', class: 'wk-wire' }));
            s.g.firstChild.setAttribute('fill', COLORS[pl.p.c][0]); s.g.lastChild.setAttribute('stroke', '#111214'); void i; });
          gear.classList.add('on'); svg.classList.add('powered', 'idle'); gearLabel.textContent = '장치 활성화 완료';
          ring.setAttribute('stroke-dashoffset', '0');
        }
        return;
      }
      info.appendChild(h('div', { class: 'wk-h' }, h('span', { class: 'wk-k' }, 'DEVICE'), h('span', null, 'R.S.S. 장치 활성화'),
        h('div', { class: 'wk-prog' }, h('i', { style: 'width:' + (linked * 10) + '%' }), h('span', null, linked + ' / 10'))));
      info.appendChild(h('p', null, linked < 10 ? ['전선을 ', h('b', null, '색과 도형이 모두 같은'), ' 연결부에 꽂으십시오 · 보수 ', h('b', null, '50,000,000 LEVC'), ' · 하루 한 번']
        : [h('b', null, '톱니바퀴를 시계 방향으로 두 바퀴'), ' 돌려 장치를 활성화하십시오']));
      if (linked === 10) { gear.classList.remove('off'); gearLabel.textContent = '톱니바퀴를 시계 방향으로 두 바퀴 돌리십시오'; }
    }
    status();
    return function () { clearInterval(cdT); };
  };
})();
