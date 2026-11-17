/* R.S.S. 문장: 방패 + 양 날개 벡터 (앱 화면과 아이콘 빌드 스크립트가 함께 사용) */
(function (root) {
  'use strict';
  var r1 = function (n) { return Math.round(n * 10) / 10; };

  function feather(i, side) {
    var rx = 20, ry = -24 + i * 11.5;
    var a = (-30 + i * 13) * Math.PI / 180;
    var L = 96 - i * 14, w = 11 - i * 1.3;
    var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    var tx = rx + ca * L, ty = ry + sa * L - (4 - i) * 2.2;
    var mx = rx + ca * L * 0.55, my = ry + sa * L * 0.55;
    var p = [
      [rx + nx * -w / 2, ry + ny * -w / 2],
      [mx + nx * -w * 0.95, my + ny * -w * 0.95 - 3],
      [tx, ty],
      [mx + nx * w * 0.55, my + ny * w * 0.55],
      [rx + nx * w / 2, ry + ny * w / 2]
    ].map(function (q) { return [r1(q[0] * side), r1(q[1])]; });
    var blade = 'M' + p[0] + 'Q' + p[1] + ' ' + p[2] + 'Q' + p[3] + ' ' + p[4] + 'Z';
    var spine = 'M' + r1(rx * side) + ',' + r1(ry) + 'Q' + r1(mx * side) + ',' + r1(my - 1.5) + ' ' + p[2];
    return { blade: blade, spine: spine, i: i };
  }

  var SHIELD = 'M-25,-34H25V2C25,20 13,32 0,41C-13,32 -25,20 -25,2Z';
  var SHIELD_IN = 'M-19,-28H19V2C19,16 10,25.5 0,33C-10,25.5 -19,16 -19,2Z';
  var CHEV = 'M-11,-16L0,-6L11,-16M-11,-3L0,7L11,-3';

  /* mode: 'holo' = 선 + 반투명 면 (화면용), 'solid' = 채운 면 (아이콘용) */
  function svg(opts) {
    opts = opts || {};
    var c = opts.color || '#FFB020', mode = opts.mode || 'holo';
    var fs = [];
    for (var i = 0; i < 5; i++) { fs.push(feather(i, 1)); fs.push(feather(i, -1)); }
    var out = '';
    if (mode === 'solid') {
      var dark = opts.ink || '#07080A';
      out += fs.map(function (f) { return '<path d="' + f.blade + '" fill="' + c + '"/>'; }).join('');
      out += fs.map(function (f) { return '<path d="' + f.spine + '" fill="none" stroke="' + dark + '" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>'; }).join('');
      out += '<path d="' + SHIELD + '" fill="' + c + '"/>';
      out += '<path d="' + SHIELD_IN + '" fill="none" stroke="' + dark + '" stroke-width="3"/>';
      out += '<path d="' + CHEV + '" fill="none" stroke="' + dark + '" stroke-width="5" stroke-linejoin="miter" stroke-linecap="square"/>';
    } else {
      out += '<g class="em-wings">' + fs.map(function (f) {
        return '<g class="em-f" style="--i:' + f.i + '"><path d="' + f.blade + '" fill="' + c + '" fill-opacity=".10" stroke="' + c + '" stroke-width="1.2" stroke-linejoin="round"/>' +
          '<path d="' + f.spine + '" fill="none" stroke="' + c + '" stroke-width=".7" stroke-opacity=".55"/></g>';
      }).join('') + '</g>';
      out += '<g class="em-shield"><path d="' + SHIELD + '" fill="' + (opts.ink || '#07080A') + '"/><path d="' + SHIELD + '" fill="' + c + '" fill-opacity=".14" stroke="' + c + '" stroke-width="1.6"/>' +
        '<path d="' + SHIELD_IN + '" fill="none" stroke="' + c + '" stroke-width=".8" stroke-opacity=".6"/>' +
        '<path d="' + CHEV + '" fill="none" stroke="' + c + '" stroke-width="3.2" stroke-linejoin="miter"/></g>';
    }
    var vb = opts.viewBox || '-106 -84 212 128';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"' + (opts.attrs || '') + '>' + (opts.bg ? '<rect x="-200" y="-200" width="400" height="400" fill="' + opts.bg + '"/>' : '') + out + '</svg>';
  }

  var api = { svg: svg, SHIELD: SHIELD };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RSSEmblem = api;
})(this);
