/* 캠 A-001 순찰 구역 — 셀 셰이딩 카툰 3D 장면
   참고 사진의 요소: 흐린 하늘 · 굽이치는 눈 둔덕 · 왼쪽 뒤 골짜기 · 오른쪽 언덕 위 레이더 탑 ·
   붉은 띠 2층 본관(지붕 격자 탑 + 측지 돔) · 앞 단층 별관 · 트러스 위 연결 통로 · 오른쪽 기둥 위 건물 ·
   작은 창고 · 울타리 · 안테나 마스트 · 불 켜진 창
   셀 셰이딩: MeshToonMaterial(4단 계조) + OutlineEffect(외곽선) */
(function () {
  'use strict';
  var T = window.THREE;
  var mobile = Math.min(innerWidth, innerHeight) < 700;
  // cctv=1: 앱의 CCTV 감시실 창 안에서 여러 카메라 화면을 그림 (조작 없음, 잡음·주사선 추가)
  var CCTV = /[?&]cctv=1/.test(location.search), FEED = CCTV;

  /* ───────── 렌더러 · 장면 · 카메라 ───────── */
  var renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: CCTV });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = T.LinearEncoding;   // 마지막 색 보정 패스에서 sRGB 로 변환
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  if (!CCTV) document.getElementById('stage').appendChild(renderer.domElement);   // CCTV: 화면에 직접 그리지 않고 칸마다 복사

  var scene = new T.Scene();
  // 흐린 하늘: 위는 회청색 → 지평선은 거의 흰색, 붓으로 그은 듯한 납작한 구름층
  var sky = document.createElement('canvas'); sky.width = 2048; sky.height = 512;
  var sg = sky.getContext('2d'), grad = sg.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5d7499'); grad.addColorStop(0.3, '#7890b2'); grad.addColorStop(0.43, '#8da2c1'); grad.addColorStop(0.475, '#aebfd5'); grad.addColorStop(0.493, '#cdd7e5'); grad.addColorStop(0.5, '#dfe6ef'); grad.addColorStop(1, '#dfe6ef');
  sg.fillStyle = grad; sg.fillRect(0, 0, 2048, 512);
  (function clouds() {
    var rnd = (function (a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(7);
    for (var i = 0; i < 70; i++) {
      var y = 150 + rnd() * 100, x = rnd() * 2048, w = 160 + rnd() * 420, hh = 2 + rnd() * 9 * (1 - (y - 130) / 130);
      var lit = rnd() < 0.55, a = 0.07 + rnd() * 0.1;
      sg.fillStyle = lit ? 'rgba(232,238,247,' + a + ')' : 'rgba(84,102,132,' + a * 0.8 + ')';
      [x, x - 2048].forEach(function (xx) { sg.beginPath(); sg.ellipse(xx, y, w, hh, 0, 0, Math.PI * 2); sg.fill(); });
    }
  })();
  var skyTex = new T.CanvasTexture(sky); skyTex.encoding = T.sRGBEncoding;
  var skyMat = new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false, toneMapped: false });
  skyMat.userData.outlineParameters = { visible: false };
  var skyDome = new T.Mesh(new T.SphereGeometry(800, 48, 24), skyMat); skyDome.renderOrder = -1;
  scene.background = new T.Color(0xe3e9f1);
  scene.add(skyDome);
  scene.fog = new T.Fog(0xdce4ee, 120, 380);

  var camera = new T.PerspectiveCamera(FEED ? 68 : (innerWidth / innerHeight < 1.2 ? 52 : 41), innerWidth / innerHeight, FEED ? 0.15 : 0.5, 900);
  var HOME = { pos: new T.Vector3(-0.8, 22.2, 58.7), target: new T.Vector3(6.2, 6, -9.5) };   // 사진 기준점 5곳에 맞춰 계산한 구도
  // 세로 화면(휴대폰)은 기지 전체가 들어오도록 뒤로 물러나고 살짝 왼쪽(본관)으로 조준
  var narrow = innerWidth / innerHeight < 1.2;
  if (narrow) {
    var k = Math.min(1.9, 1.15 / (innerWidth / innerHeight));
    HOME.target.x -= 4;
    HOME.pos.sub(HOME.target).multiplyScalar(k).add(HOME.target);
  }
  camera.position.copy(HOME.pos);

  /* ───────── 빛 ───────── */
  scene.add(new T.HemisphereLight(0xa9bcdc, 0x4d5c80, 0.62));
  var back = new T.DirectionalLight(0xbcd0ff, 0.22); back.position.set(70, 30, -80); scene.add(back);
  var sun = new T.DirectionalLight(0xfff0dc, 0.9);
  sun.position.set(-80, 34, 42);
  sun.castShadow = true;
  var sm = mobile ? 2048 : 4096;
  sun.shadow.mapSize.set(sm, sm);
  var sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 260;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2.5;
  scene.add(sun);

  /* ───────── 셀 셰이딩 재질 ───────── */
  // 계조 4단: 각 단에 색을 넣어 그늘이 회색이 아니라 차가운 푸른빛으로 떨어지게
  var steps = new Uint8Array([
    70, 84, 122, 255,
    128, 142, 180, 255,
    206, 214, 232, 255,
    255, 252, 244, 255]);
  var gradMap = new T.DataTexture(steps, 4, 1, T.RGBAFormat);
  gradMap.minFilter = gradMap.magFilter = T.NearestFilter; gradMap.needsUpdate = true;
  var GLSL_NOISE = [
    'varying vec3 vWP; varying vec3 vWN;',
    'float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }'
  ].join('\n');
  /* kind: 'panel' 벽 패널 이음새 · 'snow' 지형 바람결과 절벽 지층 · 'plain' 계조와 가장자리 빛만 */
  var SUNVIEW = { value: new T.Vector3(0, 1, 0) };
  function enhance(mat, kind, rim) {
    mat.customProgramCacheKey = function () { return 'rss-' + kind; };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.rimCol = { value: new T.Color(0xdfe9ff).multiplyScalar(rim == null ? 0.16 : rim) };
      sh.uniforms.sunView = SUNVIEW;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      var detail = '';
      if (kind === 'panel') detail = [
        'vec3 an = abs(vWN); float side = step(an.y, 0.5);',
        'float u = an.x > an.z ? vWP.z : vWP.x;',
        'float f = fract(u / 1.35); float seam = 1.0 - smoothstep(0.0, 0.035, min(f, 1.0 - f));',
        'float g = fract(vWP.y / 1.55); float rib = 1.0 - smoothstep(0.0, 0.03, min(g, 1.0 - g));',
        'float streak = vn(vec2(u * 2.3, vWP.y * 0.25));',
        'diffuseColor.rgb *= 1.0 - side * (0.3 * max(seam, rib * 0.6) + 0.1 * streak);'
      ].join('\n');
      if (kind === 'snow') detail = [
        'float rock = 1.0 - smoothstep(0.55, 0.95, vColor.r);',
        'float st = vn(vec2(vWP.x * 0.035 + vWP.z * 0.01, vWP.z * 0.22));',
        'diffuseColor.rgb *= 1.0 - 0.045 * st * (1.0 - rock);',
        'snowSheen = (1.0 - rock);',
        'float band = abs(fract(vWP.y * 0.3 + vn(vWP.xz * 0.07) * 2.6 + vn(vWP.xz * 0.3) * 0.4) - 0.5);',
        'float strata = (1.0 - smoothstep(0.06, 0.16, band)) * smoothstep(0.35, 0.6, vn(vec2(vWP.x * 0.15, vWP.y * 0.5)));',
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.23, 0.3), strata * rock * 0.55);'
      ].join('\n');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 rimCol; uniform vec3 sunView; float snowSheen = 0.0;\n' + GLSL_NOISE)
        .replace('return vec3( texture2D( gradientMap, coord ).r );', 'return texture2D( gradientMap, coord ).rgb;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + detail)
        .replace('#include <output_fragment>',
          'float fr = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);\noutgoingLight += rimCol * smoothstep(0.62, 0.68, fr) * diffuseColor.rgb;\n' +
          'float sp = pow(max(dot(reflect(-sunView, normal), normalize(vViewPosition)), 0.0), 18.0);\noutgoingLight += vec3(1.0, 0.97, 0.92) * smoothstep(0.45, 0.5, sp) * 0.09 * snowSheen;\n#include <output_fragment>');
    };
    return mat;
  }
  var toon = function (c, extra, kind, rim) { return enhance(new T.MeshToonMaterial(Object.assign({ color: c, gradientMap: gradMap }, extra || {})), kind || 'plain', rim); };
  var M = {
    snow: toon(0xf1f4fa), wall: toon(0x24272c, null, 'panel', 0.3), wallD: toon(0x24272c, null, 'panel', 0.3), red: toon(0x6a2416, null, 'panel', 0.25),
    steel: toon(0x2c3036, null, 'plain', 0.35), roof: toon(0xf6f8fc), dome: toon(0xf3f5f9, { flatShading: true }, 'plain', 0.08), dark: toon(0x2c3036, null, 'plain', 0.3), wood: toon(0x4a4038),
    glow: new T.MeshBasicMaterial({ color: 0xffd889, toneMapped: false }), door: toon(0x484d55, null, 'panel', 0.3)
  };
  M.glow.userData.outlineParameters = { visible: false };
  var NO_OUTLINE = { visible: false };
  var bucket = {}, lineBucket = [];
  var glowPts = [];
  function put(m) {
    if (m.material === M.glow) glowPts.push(m.position.clone()); (bucket[m.material.uuid] = bucket[m.material.uuid] || { mat: m.material, list: [], cast: m.castShadow }).list.push(m); return m; }

  /* ───────── 지형: 둔덕 · 골짜기 · 오른쪽 언덕 · 기지 터 ───────── */
  function n2(x, z) { // 가벼운 값 잡음 (부드러운 둔덕)
    return Math.sin(x * 0.045 + z * 0.02) * 1.3 + Math.sin(x * 0.11 - z * 0.07) * 0.6 + Math.cos(z * 0.06 + x * 0.013) * 1.1 + Math.sin((x + z) * 0.2) * 0.18;
  }
  function gauss(x, z, cx, cz, r) { var dx = x - cx, dz = z - cz; return Math.exp(-(dx * dx + dz * dz) / (r * r)); }
  // 바람에 깎인 비대칭 눈 둔덕: 바람받이는 완만, 바람그늘은 가파름
  function dune(x, z) {
    var u = x * 0.07 + z * 0.05 + Math.sin(z * 0.045 + x * 0.01) * 1.6, f = u - Math.floor(u);
    var prof = f < 0.72 ? f / 0.72 : (1 - f) / 0.28;
    var amp = 0.9 + 0.7 * Math.sin(x * 0.021 - z * 0.033);
    return (prof * prof * (3 - 2 * prof) - 0.5) * amp;
  }
  // 골짜기 중심선: [x, z, 깊이, 반폭]. 사진처럼 왼쪽 뒤에서 본관 뒤를 돌아 통로 밑을 지나 앞 오른쪽으로 얕아짐
  var CH = [[-150, -104, 15, 10], [-62, -64, 15, 9], [-32, -36, 12, 7.5], [-10, -18, 8, 6], [2, -8, 6, 5.5], [10, 3, 4.5, 5], [16, 12, 3.2, 4.5], [21, 20, 1.6, 4], [25, 27, 0, 3.5]];
  function channel(x, z) {
    var best = 1e9, dep = 0, hw = 1;
    for (var i = 0; i < CH.length - 1; i++) {
      var a = CH[i], b = CH[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
      var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      var px = a[0] + dx * t - x, pz = a[1] + dz * t - z, d = Math.sqrt(px * px + pz * pz);
      if (d < best) { best = d; dep = a[2] + (b[2] - a[2]) * t; hw = a[3] + (b[3] - a[3]) * t; }
    }
    var wob = 1 + 0.12 * Math.sin(x * 0.21 + z * 0.13);       // 벽이 곧지 않게
    var r = best / (hw * wob); if (r >= 1) return 0;
    var f = 1 - r <= 0 ? 0 : 1 - smooth(0.32, 1.0, r);
    return dep * f;
  }
  function smooth(a, b, v) { var t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
  function height(x, z) {
    var y = n2(x, z) * 1.6 + dune(x, z);
    y += Math.sin(x * 0.55 + z * 0.35) * 0.12 + Math.sin(x * 0.9 - z * 0.6) * 0.07;      // 바람결 (잔물결)
    y += 13 * gauss(x, z, 70, -112, 24) + 6 * gauss(x, z, 95, -100, 30) + 3.5 * gauss(x, z, 40, -118, 22) + 2.5 * gauss(x, z, -20, -140, 50);   // 오른쪽 언덕 · 낮은 능선
    y += 0.8 * gauss(x, z, 19, -8, 11) + 1.2 * gauss(x, z, 35, -8, 8);                  // 오른쪽 건물 · 창고 둔덕
    y += 4.5 * gauss(x, z, -42, 30, 14) + 5.5 * gauss(x, z, 44, 34, 18) + 3 * gauss(x, z, 20, 40, 10);   // 앞쪽 큰 눈더미
    y -= channel(x, z);
    var pad = Math.max(gauss(x, z, -14, 1, 15), gauss(x, z, 18, -7, 10), gauss(x, z, 35, -7, 6), gauss(x, z, -6, 9, 8));
    return y * (1 - 0.8 * pad) + pad * (gauss(x, z, 18, -7, 10) * 0.8 + gauss(x, z, 35, -7, 6) * 1.2);
  }
  (function terrain() {
    var seg = mobile ? 240 : 400, size = 420;
    var g = new T.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    // 가파른 곳은 푸른 회색 (골짜기 절벽 · 둔덕 그늘)
    var nrm = g.attributes.normal, col = new Float32Array(p.count * 3), white = new T.Color(0xf3f6fb), cliff = new T.Color(0x46526b), c = new T.Color();
    for (var j = 0; j < p.count; j++) {
      var steep = 1 - nrm.getY(j); var k = Math.min(1, Math.max(0, (steep - 0.05) * 2.4));
      c.copy(white).lerp(cliff, k * (0.4 + 0.6 * k)); col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    var mat = enhance(new T.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradMap }), 'snow', 0.1);
    mat.userData.outlineParameters = { thickness: 0.0016, color: [0.3, 0.34, 0.42] };
    var m = new T.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  })();
  var groundAt = function (x, z) { return height(x, z); };

  /* ───────── 부품 ───────── */
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return parent ? (parent.add(m), m) : put(m);
  }
  function cyl(rt, rb, h, mat, x, y, z, seg, parent) {
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 10), mat);
    m.position.set(x, y, z); m.castShadow = true; return parent ? (parent.add(m), m) : put(m);
  }
  function beam(a, b, r, mat, parent) { // 두 점 사이 가는 강철 부재
    var dir = new T.Vector3().subVectors(b, a), len = dir.length();
    var m = new T.Mesh(new T.BoxGeometry(r, len, r), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true; return parent ? (parent.add(m), m) : put(m);
  }
  // 불 켜진 창: 벽면 바로 앞에 붙는 작은 판
  function windows(cx, cy, cz, face, count, span, w, h, skip) {
    for (var i = 0; i < count; i++) {
      if (skip && skip.indexOf(i) >= 0) continue;
      var t = count === 1 ? 0 : (i / (count - 1) - 0.5) * span;
      var m = new T.Mesh(new T.PlaneGeometry(w, h), M.glow);
      if (face === 'z') m.position.set(cx + t, cy, cz + 0.03);
      else if (face === '-x') { m.position.set(cx - 0.03, cy, cz + t); m.rotation.y = -Math.PI / 2; }
      else if (face === 'x') { m.position.set(cx + 0.03, cy, cz + t); m.rotation.y = Math.PI / 2; }
      put(m);
      // 창틀
      var f = new T.Mesh(new T.PlaneGeometry(w + 0.18, h + 0.18), M.dark);
      f.position.copy(m.position); f.rotation.copy(m.rotation);
      if (face === 'z') f.position.z -= 0.015; else f.position.x += face === 'x' ? -0.015 : 0.015;
      f.material.userData.outlineParameters = NO_OUTLINE; put(f);
    }
  }
  function roofSnow(w, d, x, y, z, over) {
    over = over == null ? 0.35 : over;
    var m = box(w + over, 0.42, d + over, M.roof, x, y + 0.21, z);
    box(w * 0.9, 0.25, d * 0.85, M.roof, x - w * 0.03, y + 0.52, z + d * 0.02); // 지붕 위 눈 더미
    return m;
  }
  function stilts(x0, x1, z0, z1, top, nx, nz) {
    for (var i = 0; i < nx; i++) for (var j = 0; j < nz; j++) {
      var x = x0 + (x1 - x0) * i / (nx - 1), z = z0 + (z1 - z0) * j / (nz - 1), g = groundAt(x, z) - 0.6;
      box(0.32, top - g, 0.32, M.steel, x, (top + g) / 2, z);
    }
  }
  function stairs(x, z, topY, dirX, width) { // 바닥까지 내려가는 철계단
    var g = groundAt(x + dirX * 3, z), n = Math.max(4, Math.round((topY - g) / 0.32)), run = 3.2;
    for (var i = 0; i < n; i++) {
      var t = i / n;
      box(0.55, 0.08, width, M.steel, x + dirX * run * t, topY - (topY - g) * t, z);
    }
    var a = new T.Vector3(x, topY + 1, z + width / 2), b = new T.Vector3(x + dirX * run, g + 1, z + width / 2);
    beam(a, b, 0.07, M.steel); beam(a.clone().setZ(z - width / 2), b.clone().setZ(z - width / 2), 0.07, M.steel);
    beam(new T.Vector3(x, topY, z), new T.Vector3(x + dirX * run, g, z), 0.18, M.steel);
  }
  function mast(x, y, z, h, w, arms) { // 격자 안테나 마스트
    var base = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (var i = 0; i < 4; i++) {
      var a = new T.Vector3(x + base[i][0] * w, y, z + base[i][1] * w), b = new T.Vector3(x + base[i][0] * w * 0.25, y + h, z + base[i][1] * w * 0.25);
      beam(a, b, 0.09, M.steel);
    }
    var lv = Math.max(3, Math.round(h / 1.6));
    for (var k = 1; k < lv; k++) {
      var t = k / lv, s = w * (1 - 0.75 * t), yy = y + h * t;
      for (var e = 0; e < 4; e++) {
        var p = base[e], q = base[(e + 1) % 4];
        beam(new T.Vector3(x + p[0] * s, yy, z + p[1] * s), new T.Vector3(x + q[0] * s, yy, z + q[1] * s), 0.06, M.steel);
      }
    }
    beam(new T.Vector3(x, y + h, z), new T.Vector3(x, y + h + 1.6, z), 0.08, M.steel);
    (arms || []).forEach(function (a) { beam(new T.Vector3(x - a[1], y + h * a[0], z), new T.Vector3(x + a[1], y + h * a[0], z), 0.07, M.steel); });
    return new T.Vector3(x, y + h, z);
  }
  function wire(a, b, sag) { // 늘어진 전선
    var pts = [];
    for (var i = 0; i <= 16; i++) { var t = i / 16, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * (sag || 1.2); pts.push(p); }
    for (var j = 1; j < pts.length; j++) lineBucket.push(pts[j - 1], pts[j]);
  }
  function radome(x, y, z, r) { // 측지 돔: 면이 보이는 이십면체 + 패널 이음선
    var g = new T.IcosahedronGeometry(r, 2);
    var m = new T.Mesh(g, M.dome); m.position.set(x, y, z); m.castShadow = true; put(m);
    var e = new T.LineSegments(new T.EdgesGeometry(g, 1), new T.LineBasicMaterial({ color: 0x7c8593 }));
    e.position.copy(m.position); scene.add(e);
    return m;
  }
  function latticeDrum(x, y, z, r, h) { // 돔을 받치는 원통 격자 탑
    var n = 12;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
      var p0 = new T.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r), p1 = new T.Vector3(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r);
      beam(p0, p1, 0.1, M.steel);
      beam(p0, new T.Vector3(x + Math.cos(b) * r, y + h, z + Math.sin(b) * r), 0.05, M.steel);
    }
    [0.02, 0.5, 1].forEach(function (t) {
      var ring = new T.Mesh(new T.TorusGeometry(r, 0.07, 6, 28), M.steel);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y + h * t, z); ring.castShadow = true; put(ring);
    });
    cyl(r * 1.08, r * 1.08, 0.3, M.wallD, x, y + h + 0.15, z, 24);
  }
  function drift(x, z, sx, sy, sz) { // 건물 밑에 쌓인 눈
    var m = new T.Mesh(new T.SphereGeometry(1, 16, 10), M.snow);
    m.scale.set(sx, sy, sz); m.position.set(x, groundAt(x, z) - sy * 0.25, z); m.receiveShadow = true; m.castShadow = true; put(m);
  }

  /* ───────── 본관 (왼쪽): 기둥 위 2층, 붉은 띠, 지붕 격자 탑 + 측지 돔 ───────── */
  (function main() {
    var x = -15, z = -2, base = 1.4, w = 13, d = 8.5, h1 = 3.2, h2 = 3.0;
    stilts(x - w / 2 + 0.6, x + w / 2 - 0.6, z - d / 2 + 0.6, z + d / 2 - 0.6, base, 5, 3);
    box(w, 0.35, d, M.steel, x, base + 0.17, z);
    box(w, h1, d, M.wall, x, base + 0.35 + h1 / 2, z);
    var y2 = base + 0.35 + h1;
    box(w - 0.6, h2, d - 0.5, M.wall, x + 0.2, y2 + h2 / 2, z - 0.1);
    // 붉은 띠 (위층 가운데를 한 바퀴)
    box(w - 0.5, 1.05, d - 0.4, M.red, x + 0.2, y2 + h2 * 0.52, z - 0.1);
    // 층 사이 띠 · 패널 이음
    box(w + 0.1, 0.22, d + 0.1, M.wallD, x, y2, z);
    for (var i = 0; i < 7; i++) box(0.08, h1, 0.06, M.wallD, x - w / 2 + 1 + i * 2, base + 0.35 + h1 / 2, z + d / 2 + 0.01);
    windows(x, base + 0.35 + h1 * 0.55, z + d / 2, 'z', 6, w - 3, 0.9, 0.75, [2]);
    windows(x - w / 2, base + 0.35 + h1 * 0.55, z, '-x', 3, d - 3, 0.9, 0.75);
    windows(x + 0.2, y2 + h2 * 0.2, z - 0.1 + (d - 0.5) / 2, 'z', 5, w - 4, 0.8, 0.55);
    box(1.2, 2.1, 0.12, M.door, x + 1.6, base + 0.35 + 1.05, z + d / 2 + 0.06);
    roofSnow(w - 0.6, d - 0.5, x + 0.2, y2 + h2, z - 0.1);
    // 지붕 위: 격자 탑 + 돔 (왼쪽 뒤), 마스트, 설비 상자
    var ry = y2 + h2 + 0.4;
    latticeDrum(x - 3.2, ry, z - 1.6, 1.7, 2.6);
    radome(x - 3.2, ry + 2.6 + 2.2, z - 1.6, 2.55);
    mast(x + 3.4, ry, z + 0.4, 6.5, 0.55, [[0.55, 1.3], [0.85, 0.9]]);
    box(1.6, 0.9, 1.2, M.wallD, x + 5.4, ry + 0.45, z - 2.4);
    box(1.0, 0.7, 1.0, M.wallD, x + 0.8, ry + 0.35, z + 2.6);
    // 왼쪽 낮은 부속 건물
    box(5, 2.2, 4, M.wallD, x - w / 2 - 2.2, groundAt(x - w / 2 - 2.2, z + 2.5) + 1.0, z + 2.5);
    roofSnow(5, 4, x - w / 2 - 2.2, groundAt(x - w / 2 - 2.2, z + 2.5) + 2.1, z + 2.5, 0.25);
    drift(x - 4, z + d / 2 + 1.2, 6, 1.4, 2.2); drift(x + 5, z - d / 2 - 1, 5, 1.2, 2);
  })();

  // 오른쪽 건물 자리 (통로 끝을 여기에 맞춤): 사진처럼 앞으로 나와 있고 왼쪽 기둥이 골짜기 비탈에 섬
  var EAST = { x: 18, z: -7, w: 15 }; EAST.base = groundAt(18, -7) + 2.6;

  /* ───────── 앞 단층 별관 (눈 덮인 지붕, 오른쪽 계단) ───────── */
  (function annex() {
    var x = -5, z = 8.5, base = groundAt(-5, 8.5) + 1.7, w = 9, d = 5.4, h = 2.9;
    stilts(x - w / 2 + 0.5, x + w / 2 - 0.5, z - d / 2 + 0.5, z + d / 2 - 0.5, base, 4, 2);
    box(w, h, d, M.wall, x, base + h / 2, z);
    box(w + 0.05, 0.22, d + 0.05, M.wallD, x, base + 0.1, z);
    windows(x - 1, base + h * 0.58, z + d / 2, 'z', 4, w - 4, 0.85, 0.7);
    box(1.1, 2.0, 0.12, M.door, x + 3.4, base + 1.0, z + d / 2 + 0.06);
    roofSnow(w, d, x, base + h, z, 0.5);
    stairs(x + w / 2, z + 1.4, base, 1, 1.1);
    drift(x - 2, z + d / 2 + 1.4, 5.5, 1.1, 1.8);
  })();

  /* ───────── 연결 통로 (트러스 다리 위) ───────── */
  (function walkway() {
    var A = new T.Vector3(-8.4, 4.4, -3.4), B = new T.Vector3(EAST.x - EAST.w / 2 + 0.2, EAST.base + 0.4, EAST.z - 0.6);
    var dir = new T.Vector3().subVectors(B, A), len = dir.length(), d = 2.5, h = 2.1;
    var g = new T.Group(); g.position.copy(A);
    g.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), dir.clone().normalize());
    scene.add(g);
    var body = new T.Mesh(new T.BoxGeometry(len, h, d), M.wall); body.position.set(len / 2, h / 2, 0); g.add(body);
    var floor = new T.Mesh(new T.BoxGeometry(len + 0.1, 0.25, d + 0.15), M.wallD); floor.position.set(len / 2, 0, 0); g.add(floor);
    var snow = new T.Mesh(new T.BoxGeometry(len + 0.25, 0.4, d + 0.3), M.roof); snow.position.set(len / 2, h + 0.2, 0); g.add(snow);
    for (var i = 0; i < 10; i++) {
      var wdw = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), M.glow); wdw.position.set(1.4 + i * (len - 2.8) / 9, h * 0.58, d / 2 + 0.03); g.add(wdw);
    }
    g.updateMatrixWorld(true);
    g.children.slice().forEach(function (c) { c.applyMatrix4(g.matrixWorld); c.castShadow = true; g.remove(c); put(c); });
    scene.remove(g);
    // 트러스 다리 (X 가새), 통로 방향으로 세 곳
    [0.22, 0.52, 0.82].forEach(function (f) {
      var P = A.clone().addScaledVector(dir, f), top = P.y, gy = groundAt(P.x, P.z) - 0.4;
      var side = new T.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(d / 2 - 0.2), fw = dir.clone().setY(0).normalize();
      [-1, 1].forEach(function (sg) {
        var o = P.clone().addScaledVector(side, sg);
        var at = function (u, y) { return new T.Vector3(o.x + fw.x * u, y, o.z + fw.z * u); };
        beam(at(-1.1, gy), at(-0.6, top), 0.16, M.steel); beam(at(1.1, gy), at(0.6, top), 0.16, M.steel);
        for (var k = 0; k < 3; k++) {
          var ya = gy + (top - gy) * k / 3, yb = gy + (top - gy) * (k + 1) / 3, wa = 1.1 - 0.5 * k / 3, wb = 1.1 - 0.5 * (k + 1) / 3;
          beam(at(-wa, ya), at(wb, yb), 0.08, M.steel); beam(at(wa, ya), at(-wb, yb), 0.08, M.steel); beam(at(-wb, yb), at(wb, yb), 0.07, M.steel);
        }
      });
    });
  })();

  /* ───────── 오른쪽 건물 (기둥 위, 지붕 안테나, 계단) ───────── */
  (function east() {
    var x = EAST.x, z = EAST.z, base = EAST.base, w = EAST.w, d = 7, h = 3.6;
    stilts(x - w / 2 + 0.5, x + w / 2 - 0.5, z - d / 2 + 0.5, z + d / 2 - 0.5, base, 5, 3);
    box(w, 0.3, d, M.steel, x, base + 0.15, z);
    box(w, h, d, M.wall, x, base + 0.3 + h / 2, z);
    for (var i = 0; i < 7; i++) box(0.08, h, 0.06, M.wallD, x - w / 2 + 1 + i * 2, base + 0.3 + h / 2, z + d / 2 + 0.01);
    windows(x, base + 0.3 + h * 0.55, z + d / 2, 'z', 6, w - 3, 0.85, 0.7, [4]);
    box(1.1, 2.1, 0.12, M.door, x + 4.6, base + 0.3 + 1.05, z + d / 2 + 0.06);
    roofSnow(w, d, x, base + 0.3 + h, z, 0.5);
    var ry = base + 0.3 + h + 0.5;
    var t1 = mast(x - 3.5, ry, z - 0.5, 5.5, 0.4, [[0.6, 1.0]]);
    var t2 = mast(x + 4.5, ry, z + 0.8, 3.6, 0.3);
    cyl(0.12, 0.12, 4, M.steel, x + 1, ry + 2, z - 1.8, 6);
    stairs(x + w / 2, z + 1.8, base + 0.3, 1, 1.1);
    drift(x, z + d / 2 + 1.5, 7, 1.0, 2); drift(x - 6, z - d / 2 - 1.3, 4, 1.2, 1.8);
    wire(t1, new T.Vector3(x - 9, groundAt(x - 9, z - 4), z - 4), 0.6);
    wire(t2, new T.Vector3(x + 12, groundAt(x + 12, z + 1), z + 1), 0.8);
  })();

  /* ───────── 작은 창고 · 마스트 · 울타리 ───────── */
  (function outskirts() {
    var x = 35, z = -7, base = groundAt(35, -7) + 0.8;
    stilts(x - 2, x + 2, z - 1.3, z + 1.3, base, 2, 2);
    box(5, 2.6, 3.4, M.wall, x, base + 1.3, z);
    windows(x - 0.8, base + 1.5, z + 1.7, 'z', 1, 0, 0.8, 0.6);
    roofSnow(5, 3.4, x, base + 2.6, z, 0.3);
    var tm = mast(x + 4, groundAt(x + 4, z - 2), z - 2, 7, 0.35, [[0.7, 0.9]]);
    wire(tm, new T.Vector3(x + 9, groundAt(x + 9, z + 3) + 1.3, z + 3), 0.5);
    mast(3, groundAt(3, -20), -20, 9, 0.4, [[0.6, 1.1], [0.85, 0.7]]);
    mast(-27, groundAt(-27, -10), -10, 6.5, 0.35, [[0.7, 0.9]]);
    mast(24, groundAt(24, -22), -22, 7.5, 0.35, [[0.65, 1.0]]);
    // 기울어진 나무 울타리 (오른쪽으로 이어짐)
    var prev = null;
    for (var i = 0; i < 12; i++) {
      var fx = 39.5 + i * 1.7, fz = -6.2 + i * 0.35 + Math.sin(i * 1.7) * 0.3, gy = groundAt(fx, fz);
      var post = box(0.22, 1.7, 0.22, M.wood, fx, gy + 0.6, fz);
      post.rotation.z = Math.sin(i * 2.3) * 0.12; post.rotation.x = Math.cos(i * 1.9) * 0.08;
      var top = new T.Vector3(fx, gy + 1.35, fz);
      if (prev && i % 4 !== 3) { beam(prev, top, 0.06, M.wood); beam(prev.clone().setY(prev.y - 0.5), top.clone().setY(top.y - 0.5), 0.05, M.wood); }
      prev = top;
    }
  })();

  /* ───────── 오른쪽 뒤 언덕 꼭대기 레이더 탑 ───────── */
  (function hilltop() {
    var x = 70, z = -112, g = groundAt(x, z);
    cyl(1.9, 2.2, 4.2, M.wallD, x, g + 2.1, z, 16);
    cyl(2.4, 2.4, 0.4, M.wall, x, g + 4.3, z, 18);
    radome(x, g + 6.6, z, 2.7);
    box(3, 1.8, 2.2, M.wall, x - 4, g + 0.6, z + 2);
  })();

  /* ───────── 발자국 · 사람 하나 ───────── */
  (function details() {
    var dot = new T.CircleGeometry(0.22, 10).scale(0.75, 1.5, 1), dm = new T.MeshBasicMaterial({ color: 0xb4bfd0 });
    dm.userData.outlineParameters = NO_OUTLINE;
    for (var i = 0; i < 38; i++) {
      var t = i / 38, x = 2 + t * 24 + Math.sin(i) * 0.3, z = 12 + t * 8 + Math.sin(t * 5) * 1.5 + (i % 2 ? 0.4 : -0.4);
      var m = new T.Mesh(dot, dm); m.rotation.x = -Math.PI / 2; m.position.set(x, groundAt(x, z) + 0.05, z); put(m);
    }
    var px = 11, pz = 15, gy = groundAt(px, pz);
    var body = cyl(0.32, 0.36, 1.2, M.dark, px, gy + 0.75, pz, 10); body.castShadow = true;
    var head = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), M.dark); head.position.set(px, gy + 1.55, pz); head.castShadow = true; put(head);
  })();

  /* ───────── 모은 부품을 재질별로 합치기 (그리기 횟수를 수백 → 십여 개로) ───────── */
  (function merge() {
    Object.keys(bucket).forEach(function (k) {
      var b = bucket[k], geoms = b.list.map(function (m) {
        m.updateMatrix();
        var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        ['uv2', 'color'].forEach(function (a) { if (g.attributes[a]) g.deleteAttribute(a); });
        return g.applyMatrix4(m.matrix);
      });
      var merged = T.BufferGeometryUtils.mergeBufferGeometries(geoms, false);
      var mesh = new T.Mesh(merged, b.mat); mesh.castShadow = b.cast !== false; mesh.receiveShadow = true;
      scene.add(mesh);
    });
    if (lineBucket.length) scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(lineBucket), new T.LineBasicMaterial({ color: 0x353a43 })));
  })();

  // 둥근 눈송이 모양 (점이 네모로 보이지 않게)
  var SOFTDOT = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c);
  })();
  /* ───────── 바람에 날리는 가는 눈 (아주 약하게) ───────── */
  var flakes = (function () {
    var n = mobile ? 350 : 700, pos = new Float32Array(n * 3), spd = new Float32Array(n);
    for (var i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 160; pos[i * 3 + 1] = Math.random() * 45; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; spd[i] = 0.6 + Math.random(); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ color: 0xffffff, size: 0.28, map: SOFTDOT, transparent: true, opacity: 0.8, depthWrite: false });
    var p = new T.Points(g, m); scene.add(p);
    return { p: p, pos: pos, spd: spd, n: n };
  })();

  /* ───────── 창에서 새어나오는 따뜻한 빛 (눈 위에 둥근 빛 웅덩이) ───────── */
  [[-15, 2.6, 3.2], [-15, 5.8, 2.6], [-5, 3.4, 12.3], [18, 4.8, -2.6], [35, 2.8, -4.8], [1, 5.2, -4.2], [-22.5, 2.6, -2]].forEach(function (q) {
    var l = new T.PointLight(0xffb469, 1.25, 11, 2); l.position.set(q[0], q[1] + (q === undefined ? 0 : 0), q[2]); scene.add(l);
  });

  /* ───────── 창 빛무리: 부드러운 원형 번짐 (깜빡이지 않음) ───────── */
  (function halos() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,214,140,0.9)'); rg.addColorStop(0.25, 'rgba(255,190,110,0.35)'); rg.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    var pos = new Float32Array(glowPts.length * 3);
    glowPts.forEach(function (v, i) { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({ map: new T.CanvasTexture(c), size: 2.6, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
    var pts = new T.Points(geo, mat); pts.renderOrder = 2; scene.add(pts);
  })();

  /* ───────── 골짜기와 먼 들판에 깔린 낮은 안개 ───────── */
  var mists = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    for (var i = 0; i < 26; i++) {
      var x = 30 + Math.random() * 196, y = 70 + Math.random() * 116, r = 30 + Math.random() * 60;
      var rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(236,241,248,0.32)'); rg.addColorStop(1, 'rgba(236,241,248,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    }
    var tex = new T.CanvasTexture(c), list = [];
    [[-60, -66, -9, 70, 22], [-30, -40, -7, 50, 18], [-110, -88, -10, 80, 26], [6, -6, -2.5, 26, 12], [90, -150, 4, 160, 40], [-60, -170, 3, 180, 46]].forEach(function (q) {
      var m = new T.Mesh(new T.PlaneGeometry(q[3], q[4]), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
      m.material.userData.outlineParameters = NO_OUTLINE;
      m.position.set(q[0], q[2], q[1]); m.rotation.x = -Math.PI / 2 + 0.18; m.renderOrder = 3; scene.add(m);
      list.push({ m: m, x0: q[0], sp: 0.4 + Math.random() * 0.5 });
    });
    return list;
  })();

  /* ───────── 외곽선 (셀 셰이딩 윤곽) ───────── */
  var effect = new T.OutlineEffect(renderer, { defaultThickness: mobile ? 0.004 : 0.0032, defaultColor: [0.11, 0.12, 0.15], defaultAlpha: 1 });

  /* ───────── 후처리 ───────── */
  var dpr = renderer.getPixelRatio();
  var rt = new T.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: T.HalfFloatType, samples: 4 });
  var composer = new T.EffectComposer(renderer, rt);
  // 외곽선 효과로 장면을 그리는 첫 패스 (OutlineEffect 를 그대로 사용)
  var outlined = new T.Pass(); outlined.needsSwap = false;
  outlined.render = function (r, w, read) { r.setRenderTarget(read); r.setClearColor(0xdfe6ef, 1); r.clear(); effect.render(scene, view); };
  composer.addPass(outlined);
  var bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.92);
  composer.addPass(bloom);
  var grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, res: { value: new T.Vector2(innerWidth, innerHeight) }, time: { value: 0 }, feed: { value: FEED ? 1 : 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform vec2 res; uniform float time; uniform float feed; varying vec2 vUv;',
      'float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }',
      'void main(){',
      '  vec2 uv = vUv;',
      '  float band = feed * smoothstep(0.0, 0.04, 0.04 - abs(fract(uv.y - time * 0.045) - 0.5));',   // 천천히 내려가는 간섭 띠
      '  uv.x += band * 0.0035 * sin(uv.y * 900.0 + time * 3.0);',
      '  vec2 off = feed * (uv - 0.5) * 0.0045;',                                          // 가장자리 색 번짐
      '  vec3 c = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);',
      '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
      '  c += vec3(-0.012, -0.004, 0.022) * (1.0 - smoothstep(0.1, 0.6, l));',   // 그늘: 차가운 푸른빛
      '  c += vec3(0.016, 0.008, -0.01) * smoothstep(0.55, 1.0, l);',             // 밝은 곳: 아주 살짝 따뜻하게
      '  c = mix(vec3(l), c, 1.06);',                                            // 채도 조금
      '  vec2 q = vUv - 0.5; c *= 1.0 - 0.22 * smoothstep(0.35, 0.95, length(q * vec2(1.25, 1.0)));',   // 비네트
      '  vec3 o = toSRGB(max(c, 0.0));',
      '  if (feed > 0.5) {',
      '    float lum = dot(o, vec3(0.299, 0.587, 0.114)); o = mix(vec3(lum), o, 0.72);',     // 감시 카메라처럼 채도 낮춤
      '    float g = h1(floor(vUv * res / 1.5) + floor(time * 24.0)) - 0.5; o += g * 0.085;',  // 필름 잡음 (밝기 깜빡임 없이 작게)
      '    o *= 0.93 + 0.07 * sin(vUv.y * res.y * 1.5708);',                                  // 주사선
      '    o += band * 0.035;',
      '  }',
      '  gl_FragColor = vec4(o, 1.0);',
      '}'].join('\n')
  });
  composer.addPass(grade);

  /* ───────── 조작: 끌어서 회전 · 휠/핀치 확대, 가만히 두면 천천히 흔들림 ───────── */
  var frameHooks = [], view = camera;
  var controls = new T.OrbitControls(camera, renderer.domElement);
  controls.enabled = !FEED;
  controls.target.copy(HOME.target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 30; controls.maxDistance = 200;
  controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.5;
  controls.enablePan = false;
  controls.update();
  var idleSince = performance.now(), base = { az: controls.getAzimuthalAngle() };
  controls.addEventListener('start', function () { idleSince = Infinity; });
  controls.addEventListener('end', function () { idleSince = performance.now(); base.az = controls.getAzimuthalAngle(); });

  var clock = new T.Clock(), fpsEl = document.getElementById('fps'), frames = 0, fpsT = 0;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    // 손대지 않으면 3초 뒤부터 아주 느리게 좌우로 흔들림
    if (!FEED && performance.now() - idleSince > 3000) {
      var want = base.az + Math.sin(t * 0.08) * 0.12, cur = controls.getAzimuthalAngle();
      var r = camera.position.clone().sub(controls.target), rot = (want - cur) * 0.02;
      r.applyAxisAngle(new T.Vector3(0, 1, 0), rot); camera.position.copy(controls.target).add(r);
    }
    if (!FEED) controls.update();
    for (var hk = 0; hk < frameHooks.length; hk++) frameHooks[hk](dt, t);
    grade.uniforms.time.value = t;
    var P = flakes.pos;
    for (var i = 0; i < flakes.n; i++) {
      P[i * 3] += (2.2 + Math.sin(t + i) * 0.4) * dt * flakes.spd[i];
      P[i * 3 + 1] -= 1.1 * dt * flakes.spd[i];
      if (P[i * 3 + 1] < 0 || P[i * 3] > 80) { P[i * 3] = -80 + Math.random() * 20; P[i * 3 + 1] = 2 + Math.random() * 43; }
    }
    flakes.p.geometry.attributes.position.needsUpdate = true;
    for (var mi = 0; mi < mists.length; mi++) { var ms = mists[mi]; ms.m.position.x = ms.x0 + Math.sin(t * 0.03 * ms.sp + mi) * 6; }
    if (CCTV) { if (window.__cctvRender) window.__cctvRender(dt, t); }
    else renderView(camera);
    frames++; fpsT += dt;
    if (fpsT >= 1 && fpsEl) { fpsEl.textContent = Math.round(frames / fpsT) + ' FPS'; frames = 0; fpsT = 0; }
  }
  loop();

  /* 카메라 하나로 한 장면 그리기 (CCTV 는 카메라마다 이것을 불러 칸에 복사) */
  function renderView(cam) {
    view = cam;
    SUNVIEW.value.copy(sun.position).normalize().transformDirection(cam.matrixWorldInverse);
    composer.render();
  }
  function setRenderSize(w, h) {
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    composer.setSize(w, h); bloom.setSize(w, h); grade.uniforms.res.value.set(w, h);
  }
  addEventListener('resize', function () {
    if (CCTV) return;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight); grade.uniforms.res.value.set(innerWidth, innerHeight);
  });
  window.__scene = { scene: scene, camera: camera, controls: controls, renderer: renderer, height: height, bloom: bloom, sun: sun, M: M, gradMap: gradMap, enhance: enhance, FEED: FEED, CCTV: CCTV, frameHooks: frameHooks, SOFTDOT: SOFTDOT, renderView: renderView, setRenderSize: setRenderSize, grade: grade, HOME: HOME };
})();
