/* R.S.S. 문장: 방패 + 양 날개 픽셀 아트 생성기 (앱과 아이콘 빌드 스크립트가 함께 사용) */
(function (root) {
  'use strict';
  var W = 43, H = 19, CX = 21, TOP = 2;
  var SHIELD_HW = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1];
  var FEATHERS = [15, 13, 11, 8, 5];

  function build() {
    var mask = {}, px = [];
    var key = function (x, y) { return x + ',' + y; };
    SHIELD_HW.forEach(function (hw, r) {
      for (var x = CX - hw; x <= CX + hw; x++) mask[key(x, TOP + r)] = 1;
    });
    var inMask = function (x, y) { return !!mask[key(x, y)]; };
    // 체비셰프 거리 침식: 사선 가장자리에서도 테두리가 끊기지 않게
    var eroded = function (x, y, n) {
      for (var dy = -n; dy <= n; dy++) for (var dx = -n; dx <= n; dx++) if (!inMask(x + dx, y + dy)) return false;
      return true;
    };
    // 방패 안의 계급 V자 2개
    var chev = {};
    [3, 6].forEach(function (b) {
      for (var i = 0; i < 3; i++) {
        var y = TOP + b + i, d = 2 - i;
        chev[key(CX - d, y)] = 1; chev[key(CX + d, y)] = 1;
        if (d > 0) { chev[key(CX - d + 1, y)] = 1; chev[key(CX + d - 1, y)] = 1; }
      }
    });
    Object.keys(mask).forEach(function (k) {
      var xy = k.split(',').map(Number), x = xy[0], y = xy[1];
      var c;
      if (!eroded(x, y, 1)) c = 'a';
      else if (!eroded(x, y, 2)) c = 'k';
      else c = chev[k] ? 'k' : 'a';
      if (c !== 'k') px.push({ x: x, y: y, c: c, part: 'shield', d: 0 });
    });
    // 날개: 깃털 줄은 2칸 두께, 1칸 간격, 바깥으로 갈수록 위로 휘어짐
    var startX = CX + SHIELD_HW[0] + 1;
    FEATHERS.forEach(function (len, f) {
      var ys = TOP + 2 + f * 3;
      for (var dx = 0; dx < len; dx++) {
        var rise = Math.floor(dx / 3);
        var tip = dx === len - 1;
        [0, 1].forEach(function (t) {
          if (tip && t === 1) return;
          var y = ys - rise + t;
          var c = t === 0 ? 'a' : 'd';
          px.push({ x: startX + dx, y: y, c: c, part: 'wing', d: dx, f: f });
          px.push({ x: 2 * CX - (startX + dx), y: y, c: c, part: 'wing', d: dx, f: f });
        });
      }
    });
    return px;
  }

  var COLORS = { a: '#FF6B1A', d: '#9C3C0C' };

  function svg(opts) {
    opts = opts || {};
    var px = build(), cell = opts.cell || 1, pad = opts.pad || 0;
    var w = W * cell + pad * 2, h = H * cell + pad * 2;
    var rects = px.map(function (p) {
      var cls = 'px ' + p.part + (p.part === 'wing' ? ' f' + p.f : '');
      var style = p.part === 'wing' ? ' style="--d:' + p.d + '"' : '';
      return '<rect class="' + cls + '"' + style + ' x="' + (pad + p.x * cell) + '" y="' + (pad + p.y * cell) +
        '" width="' + cell + '" height="' + cell + '" fill="' + COLORS[p.c] + '"/>';
    }).join('');
    var bg = opts.bg ? '<rect width="' + w + '" height="' + h + '" fill="' + opts.bg + '"/>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges"' +
      (opts.attrs || '') + '>' + bg + rects + '</svg>';
  }

  var api = { W: W, H: H, build: build, svg: svg, COLORS: COLORS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RSSEmblem = api;
})(this);
