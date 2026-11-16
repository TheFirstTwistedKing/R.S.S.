/* 관계도: 캔버스 2D 힘 기반 배치. 움직임이 멈추면 렌더 루프도 멈춰 CPU를 쓰지 않음 */
(function () {
  'use strict';
  var R = window.RSS, h = R.h;
  var POS = {};            // 노드 위치 기억 (화면을 오가도 유지)
  var VIEW = null;         // 마지막 시점 {x, y, k}
  var C = { bg: '#0C0D0F', line: 'rgba(255,176,32,.28)', lineHi: '#FFB020', text: '#F3E8D2', muted: '#A69B84', faint: '#6E6654', accent: '#FFB020', panel: '#0C0D0F' };
  var SHAPE = { character: '■', organization: '□', location: '◆', item: '▪', lore: '◇' };

  R.views.graph = function (root, opts) {
    var db = R.A;   // 내장 세계관 문서 (열람 전용)
    var wrap = h('div', { class: 'graph' });
    var cv = h('canvas', { 'aria-label': R.T('관계도', 'Relation graph') });
    wrap.appendChild(cv); root.appendChild(wrap);
    var g = cv.getContext('2d');

    var nodes = db.entities.map(function (e) {
      var p = POS[e.id] || { x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400, vx: 0, vy: 0 };
      POS[e.id] = p; p.e = e; p.id = e.id; return p;
    });
    var map = {}; nodes.forEach(function (n) { map[n.id] = n; });
    var edges = db.links.map(function (l) { return { a: map[l.a], b: map[l.b], label: l.label }; }).filter(function (l) { return l.a && l.b; });
    var deg = {}; edges.forEach(function (l) { deg[l.a.id] = (deg[l.a.id] || 0) + 1; deg[l.b.id] = (deg[l.b.id] || 0) + 1; });

    var W = 0, H = 0, dpr = 1, alpha = 1, raf = 0, dead = false;
    var view = VIEW || { x: 0, y: 0, k: 1 };
    var sel = opts && opts.focus ? opts.focus : null, hover = null, drag = null;

    /* 상단 도구 / 범례 / 선택 카드 */
    var card = h('div', { class: 'g-card', hidden: true });
    wrap.appendChild(h('div', { class: 'g-tools' },
      h('button', { class: 'btn', type: 'button', onclick: function () { fit(); } }, R.T('화면 맞춤', 'Fit view')),
      h('button', { class: 'btn', type: 'button', onclick: function () { nodes.forEach(function (n) { n.x += (Math.random() - .5) * 200; n.y += (Math.random() - .5) * 200; }); heat(1); } }, R.T('재배치', 'Shuffle'))));
    wrap.appendChild(h('div', { class: 'g-legend' }, R.TYPES.map(function (t) { return h('span', null, SHAPE[t.id] + ' ' + t.name); }),
      h('span', { style: { color: C.accent } }, R.T('■ 극비', '■ Top secret'))));
    wrap.appendChild(card);

    if (!nodes.length) {
      wrap.appendChild(h('div', { class: 'empty', style: { position: 'absolute', left: '16px', right: '16px', top: '64px', maxWidth: '520px' } },
        h('h3', null, R.T('표시할 파일이 없습니다', 'Nothing to show')), h('p', null, R.T('공개된 세계관 문서가 생기면 이곳에 관계망이 그려집니다.', 'The relation network appears here once world documents are released.')),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { R.go('files'); } }, R.T('파일로 이동', 'Go to archive'))));
    }

    function drawCard() {
      var n = sel && map[sel];
      if (!n) { card.hidden = true; return; }
      var e = n.e;
      card.hidden = false; card.innerHTML = '';
      card.appendChild(h('div', { class: 'dz-id' }, h('span', null, R.code(e)), h('span', { class: 'clr c' + e.clearance }, R.CLEAR[e.clearance].code)));
      card.appendChild(h('h4', null, e.name));
      card.appendChild(h('p', null, e.summary || (e.alias || R.type(e.type).name)));
      R.decodeTree(card, 'h4, p, .dz-id span', 50);
      card.appendChild(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn primary', type: 'button', onclick: function () { R.go('files', { select: e.id }); } }, R.T('파일 열기', 'Open document')),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { sel = null; drawCard(); paint(); } }, R.T('닫기', 'Close'))));
    }

    function resize() {
      var r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      paint();
    }

    function heat(a) { alpha = Math.max(alpha, a); if (!raf) raf = requestAnimationFrame(loop); }

    function step() {
      var n = nodes.length, i, j, a, b, dx, dy, d2, d, f;
      for (i = 0; i < n; i++) {
        a = nodes[i];
        for (j = i + 1; j < n; j++) {
          b = nodes[j]; dx = b.x - a.x; dy = b.y - a.y; d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 250000) continue;
          f = 5200 / d2 * alpha; d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      edges.forEach(function (l) {
        dx = l.b.x - l.a.x; dy = l.b.y - l.a.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = (d - 150) * 0.04 * alpha; dx /= d; dy /= d;
        l.a.vx += dx * f; l.a.vy += dy * f; l.b.vx -= dx * f; l.b.vy -= dy * f;
      });
      nodes.forEach(function (p) {
        p.vx -= p.x * 0.006 * alpha; p.vy -= p.y * 0.006 * alpha;
        if (drag && drag.node === p) { p.vx = p.vy = 0; return; }
        p.vx *= 0.6; p.vy *= 0.6;
        p.x += Math.max(-30, Math.min(30, p.vx)); p.y += Math.max(-30, Math.min(30, p.vy));
      });
      alpha *= 0.985;
    }

    function loop() {
      raf = 0;
      if (dead) return;
      step(); paint();
      if (alpha > 0.02 || drag) raf = requestAnimationFrame(loop);
    }

    var sx = function (x) { return (x - view.x) * view.k + W / 2; };
    var sy = function (y) { return (y - view.y) * view.k + H / 2; };
    var wx = function (x) { return (x - W / 2) / view.k + view.x; };
    var wy = function (y) { return (y - H / 2) / view.k + view.y; };

    function shape(t, x, y, s, fill, stroke) {
      g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 2;
      var r = Math.round;
      if (t === 'organization' || t === 'planet') {
        if (t === 'planet') { g.save(); g.translate(r(x), r(y)); g.rotate(Math.PI / 4); g.fillStyle = C.bg; g.fillRect(-s * .7, -s * .7, s * 1.4, s * 1.4); g.strokeRect(-s * .7, -s * .7, s * 1.4, s * 1.4); g.restore(); return; }
        g.fillStyle = C.bg; g.fillRect(r(x - s), r(y - s), s * 2, s * 2); g.strokeRect(r(x - s) + 1, r(y - s) + 1, s * 2 - 2, s * 2 - 2); return;
      }
      if (t === 'location') { g.save(); g.translate(r(x), r(y)); g.rotate(Math.PI / 4); g.fillRect(-s * .75, -s * .75, s * 1.5, s * 1.5); g.restore(); return; }
      if (t === 'item') { g.fillRect(r(x - s * .65), r(y - s * .65), r(s * 1.3), r(s * 1.3)); return; }
      g.fillRect(r(x - s), r(y - s), s * 2, s * 2);
    }

    function paint() {
      if (dead) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      // 격자 (선만 사용, 점 패턴 없음)
      var step = 48 * view.k; if (step > 12) {
        g.strokeStyle = 'rgba(255,176,32,0.05)'; g.lineWidth = 1; g.beginPath();
        var ox = ((W / 2 - view.x * view.k) % step + step) % step, oy = ((H / 2 - view.y * view.k) % step + step) % step;
        for (var x = ox; x < W; x += step) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, H); }
        for (var y = oy; y < H; y += step) { g.moveTo(0, Math.round(y) + .5); g.lineTo(W, Math.round(y) + .5); }
        g.stroke();
      }
      var focus = sel || hover;
      var near = {};
      if (focus) { near[focus] = 1; edges.forEach(function (l) { if (l.a.id === focus) near[l.b.id] = 1; if (l.b.id === focus) near[l.a.id] = 1; }); }

      // 연결선
      edges.forEach(function (l) {
        var hi = focus && (l.a.id === focus || l.b.id === focus);
        g.strokeStyle = hi ? C.lineHi : (focus ? 'rgba(255,176,32,.08)' : C.line);
        g.lineWidth = hi ? 2 : 1.5;
        var x1 = sx(l.a.x), y1 = sy(l.a.y), x2 = sx(l.b.x), y2 = sy(l.b.y);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        // 방향 표시: 끝 쪽 작은 사각
        var t = 0.72, mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
        g.fillStyle = hi ? C.lineHi : C.line; g.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
        if (l.label && (hi || (!focus && view.k > 0.9))) {
          var lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
          g.font = '11px D2Coding, monospace';
          var tw = g.measureText(l.label).width;
          g.fillStyle = C.bg; g.fillRect(Math.round(lx - tw / 2 - 4), Math.round(ly - 9), Math.round(tw + 8), 17);
          g.fillStyle = hi ? C.accent : C.muted; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(l.label, Math.round(lx), Math.round(ly));
        }
      });
      // 노드
      g.textAlign = 'center'; g.textBaseline = 'top';
      nodes.forEach(function (p) {
        var x = sx(p.x), y = sy(p.y);
        if (x < -80 || y < -40 || x > W + 80 || y > H + 40) return;
        var dim = focus && !near[p.id];
        var s = Math.max(4, Math.min(11, 5 + (deg[p.id] || 0))) * Math.max(0.7, Math.min(1.4, view.k));
        var col = p.e.clearance === 3 ? C.accent : C.text;
        g.globalAlpha = dim ? 0.25 : 1;
        shape(p.e.type, x, y, s, col, col);
        if (p.id === sel) { g.strokeStyle = C.accent; g.lineWidth = 2; g.strokeRect(Math.round(x - s - 5) + .0, Math.round(y - s - 5), Math.round(s * 2 + 10), Math.round(s * 2 + 10)); }
        if (view.k > 0.45 || p.id === focus || near[p.id] && focus) {
          g.font = '12px Pretendard, sans-serif';
          g.fillStyle = p.id === focus ? C.accent : (dim ? C.faint : C.text);
          g.fillText(p.e.name, Math.round(x), Math.round(y + s + 6));
        }
        g.globalAlpha = 1;
      });
    }

    function fit() {
      if (!nodes.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      nodes.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      view.x = (x0 + x1) / 2; view.y = (y0 + y1) / 2;
      view.k = Math.max(0.3, Math.min(1.6, Math.min((W - 120) / (x1 - x0 + 1), (H - 160) / (y1 - y0 + 1))));
      paint();
    }

    function pick(mx, my) {
      var best = null, bd = 18 * 18;
      nodes.forEach(function (p) { var dx = sx(p.x) - mx, dy = sy(p.y) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } });
      return best;
    }

    /* 포인터: 노드 끌기 / 빈 곳 끌어 이동 / 휠·핀치 확대 */
    var pts = {}, pinch = null;
    function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      var p = local(e); pts[e.pointerId] = p;
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; drag = null; return;
      }
      var n = pick(p.x, p.y);
      drag = { node: n, sx: p.x, sy: p.y, vx: view.x, vy: view.y, moved: false };
      cv.classList.add('drag');
      if (n) heat(0.3);
    });
    cv.addEventListener('pointermove', function (e) {
      var p = local(e);
      if (pts[e.pointerId]) pts[e.pointerId] = p;
      if (pinch) {
        var ids = Object.keys(pts); if (ids.length < 2) return;
        var a = pts[ids[0]], b = pts[ids[1]];
        view.k = Math.max(0.25, Math.min(3, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); paint(); return;
      }
      if (!drag) {
        var hv = pick(p.x, p.y), id = hv ? hv.id : null;
        cv.style.cursor = hv ? 'pointer' : '';
        if (id !== hover) { hover = id; paint(); }
        return;
      }
      if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4) drag.moved = true;
      if (drag.node) { drag.node.x = wx(p.x); drag.node.y = wy(p.y); heat(0.3); }
      else { view.x = drag.vx - (p.x - drag.sx) / view.k; view.y = drag.vy - (p.y - drag.sy) / view.k; paint(); }
    });
    function up(e) {
      delete pts[e.pointerId];
      if (pinch) { if (Object.keys(pts).length < 2) pinch = null; return; }
      if (!drag) return;
      if (!drag.moved) { sel = drag.node ? drag.node.id : null; if (drag.node) R.sound.nav(); drawCard(); paint(); }
      drag = null; cv.classList.remove('drag');
      VIEW = { x: view.x, y: view.y, k: view.k };
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e), bx = wx(p.x), by = wy(p.y);
      view.k = Math.max(0.25, Math.min(3, view.k * Math.pow(1.0015, -e.deltaY)));
      view.x = bx - (p.x - W / 2) / view.k; view.y = by - (p.y - H / 2) / view.k;
      VIEW = { x: view.x, y: view.y, k: view.k };
      paint();
    }, { passive: false });

    var ro = new ResizeObserver(resize); ro.observe(wrap);
    resize();
    var fresh = !VIEW;
    // 처음 열 때는 배치를 미리 계산해 두고 시작 (깜빡임 없이)
    if (fresh) { for (var i = 0; i < 160; i++) step(); alpha = 0.3; fit(); }
    if (sel && map[sel]) { view.x = map[sel].x; view.y = map[sel].y; view.k = Math.max(view.k, 1); }
    drawCard();
    document.fonts && document.fonts.ready.then(paint);
    heat(fresh ? 0.3 : 0.15);

    return function destroy() { dead = true; ro.disconnect(); if (raf) cancelAnimationFrame(raf); VIEW = { x: view.x, y: view.y, k: view.k }; };
  };
})();
