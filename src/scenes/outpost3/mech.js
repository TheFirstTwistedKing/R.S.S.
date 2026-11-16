/* 순찰 로봇: 기지 앞 눈밭을 한 바퀴씩 걸어 다님.
   - 모델: mech.glb.js (Mixamo 뼈대, 애니메이션 없음) → 걷기는 뼈를 직접 돌려 만듦
   - feed=1 이면 로봇 머리 카메라의 1인칭 감시 영상 (시뮬레이션 창 안에서 쓰임)
   - tp=1 이면 뒤에서 따라가는 3인칭 (점검용) */
(function () {
  'use strict';
  var T = window.THREE, S = window.__scene;
  if (!T || !S || !window.RSS_MECH_GLB) return;
  var TP = /[?&]tp=1/.test(location.search), FEED = S.FEED;
  var HEIGHT = 6.2;                      // 로봇 키 (본관 2층 지붕보다 조금 낮게)
  var SPEED = 2.3;                       // 걷는 속도 (장면 단위/초)

  /* ── 순찰 경로: 기지 앞쪽 눈밭을 도는 닫힌 곡선 (건물 · 통로 밑은 피함) ── */
  var path = new T.CatmullRomCurve3([
    [-34, 18], [-16, 31], [10, 34], [34, 26], [48, 10], [44, -2], [30, 12], [12, 19], [-10, 19], [-26, 12]
  ].map(function (p) { return new T.Vector3(p[0], 0, p[1]); }), true, 'centripetal');
  var pathLen = path.getLength();

  /* ── 모델 읽기 (base64 → ArrayBuffer) ── */
  var bin = atob(window.RSS_MECH_GLB), buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  window.RSS_MECH_GLB = null;

  new T.GLTFLoader().parse(buf.buffer, '', function (gltf) { build(gltf.scene); }, function (e) { console.error('mech', e); });

  function build(model) {
    var root = new T.Group(); S.scene.add(root);
    // 크기 맞추기: 발바닥이 0, 키가 HEIGHT
    model.updateMatrixWorld(true);
    var bb = new T.Box3().setFromObject(model), size = bb.getSize(new T.Vector3());
    var k = HEIGHT / size.y; model.scale.setScalar(k);
    model.updateMatrixWorld(true); bb.setFromObject(model);
    model.position.y -= bb.min.y; model.position.x -= (bb.min.x + bb.max.x) / 2; model.position.z -= (bb.min.z + bb.max.z) / 2;
    root.add(model);

    // 재질: 장면과 같은 셀 셰이딩으로 (색 · 노멀 텍스처는 유지)
    model.traverse(function (o) {
      if (!o.isMesh) return;
      var src = o.material;
      var m = new T.MeshToonMaterial({ map: src.map, normalMap: src.normalMap, gradientMap: S.gradMap, color: 0xffffff });
      if (m.map) m.map.encoding = T.sRGBEncoding;
      S.enhance(m, 'plain', 0.28);
      m.userData.outlineParameters = { thickness: 0.0022, color: [0.1, 0.11, 0.14] };
      o.material = m; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    });

    /* ── 뼈: 이름으로 찾고, 처음 자세(쉬는 자세)를 기억 ── */
    var bones = {};
    model.traverse(function (o) { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
    var need = ['Hips', 'Spine', 'Spine1', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'];
    var rest = {}, restParentQ = {}, rootQinv = new T.Quaternion();
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(rootQinv); rootQinv.invert();
    need.forEach(function (n) {
      var b = bones[n]; if (!b) return;
      rest[n] = b.quaternion.clone();
      var pq = new T.Quaternion(); b.parent.getWorldQuaternion(pq);
      restParentQ[n] = rootQinv.clone().multiply(pq);      // 로봇 기준 좌표계에서 부모의 방향
    });
    var hipsY = bones.Hips ? bones.Hips.position.y : 0;
    // 로봇 기준 축 (모델은 +Z 를 바라봄): X = 옆, Y = 위, Z = 앞
    var AX = new T.Vector3(1, 0, 0), AY = new T.Vector3(0, 1, 0), AZ = new T.Vector3(0, 0, 1);
    var tq = new T.Quaternion(), dq = new T.Quaternion(), pinv = new T.Quaternion();
    // 뼈를 '로봇 기준 축'으로 돌림: 부모 좌표계로 바꿔서 쉬는 자세에 곱함
    function turn(n, rots) {
      var b = bones[n]; if (!b) return;
      b.quaternion.copy(rest[n]);
      pinv.copy(restParentQ[n]).invert();
      for (var r = 0; r < rots.length; r++) {
        tq.setFromAxisAngle(rots[r][0], rots[r][1]);
        dq.copy(pinv).multiply(tq).multiply(restParentQ[n]);
        b.quaternion.premultiply(dq);
      }
    }

    /* ── 발자국 (큰 금속 발 자국, 오래된 것부터 지워짐) ── */
    var fpGeo = new T.PlaneGeometry(0.9, 1.5).rotateX(-Math.PI / 2);
    var fpMat = new T.MeshBasicMaterial({ color: 0x9aa7bd, transparent: true, opacity: 0.55, depthWrite: false });
    fpMat.userData.outlineParameters = { visible: false };
    var prints = [], printIdx = 0;
    for (var f = 0; f < 70; f++) { var pm = new T.Mesh(fpGeo, fpMat); pm.visible = false; S.scene.add(pm); prints.push(pm); }
    function stamp(x, z, yaw) {
      var pm = prints[printIdx++ % prints.length];
      pm.position.set(x, S.height(x, z) + 0.06, z); pm.rotation.set(0, yaw, 0); pm.visible = true;
    }
    /* ── 발 디딜 때 튀는 눈가루 ── */
    var puffN = 90, puffPos = new Float32Array(puffN * 3), puffVel = new Float32Array(puffN * 3), puffLife = new Float32Array(puffN), puffI = 0;
    var puffGeo = new T.BufferGeometry(); puffGeo.setAttribute('position', new T.BufferAttribute(puffPos, 3));
    var puff = new T.Points(puffGeo, new T.PointsMaterial({ color: 0xf4f7fc, size: 0.45, map: S.SOFTDOT, transparent: true, opacity: 0.85, depthWrite: false }));
    puff.frustumCulled = false; S.scene.add(puff);
    for (var q = 0; q < puffN; q++) puffPos[q * 3 + 1] = -999;
    function kick(x, y, z) {
      for (var n = 0; n < 12; n++) {
        var j = puffI++ % puffN, a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
        puffPos[j * 3] = x; puffPos[j * 3 + 1] = y + 0.1; puffPos[j * 3 + 2] = z;
        puffVel[j * 3] = Math.cos(a) * sp; puffVel[j * 3 + 1] = 1 + Math.random() * 1.5; puffVel[j * 3 + 2] = Math.sin(a) * sp; puffLife[j] = 1;
      }
    }

    /* ── 걷기 ── */
    var dist = 0, phase = 0, lastStep = 0, shake = 0, yaw = 0, look = 0, pitch = -0.1;
    var pos = new T.Vector3(), ahead = new T.Vector3(), headW = new T.Vector3(), fwd = new T.Vector3();
    var stride = 3.2;                    // 한 걸음 길이 (두 걸음 = 한 주기)
    S.frameHooks.push(function (dt, t) {
      dist = (dist + SPEED * dt) % pathLen;
      var u = dist / pathLen;
      path.getPointAt(u, pos); path.getPointAt((u + 4 / pathLen) % 1, ahead);
      var wantYaw = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      var dy = wantYaw - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yaw += dy * Math.min(1, dt * 2.2);
      phase += SPEED * dt / stride * Math.PI;           // 한 걸음마다 π
      var s = Math.sin(phase), c = Math.cos(phase);
      var gy = S.height(pos.x, pos.z);
      root.position.set(pos.x, gy - 0.05, pos.z);
      root.rotation.y = yaw;
      // 다리: 허벅지 앞뒤, 무릎은 발을 들 때만 굽힘, 발목은 땅과 평평하게
      var L = s, R = -s;
      var kneeL = Math.max(0, Math.cos(phase - 0.6)) * 0.9, kneeR = Math.max(0, -Math.cos(phase - 0.6)) * 0.9;
      turn('LeftUpLeg', [[AX, -L * 0.42 - kneeL * 0.35]]);
      turn('LeftLeg', [[AX, kneeL]]);
      turn('LeftFoot', [[AX, L * 0.25 - kneeL * 0.4]]);
      turn('RightUpLeg', [[AX, -R * 0.42 - kneeR * 0.35]]);
      turn('RightLeg', [[AX, kneeR]]);
      turn('RightFoot', [[AX, R * 0.25 - kneeR * 0.4]]);
      // 팔: T 자세에서 내리고, 다리와 반대로 조금 흔듦
      turn('LeftArm', [[AZ, -1.15], [AX, R * 0.22]]);
      turn('LeftForeArm', [[AX, -0.35]]);
      turn('RightArm', [[AZ, 1.15], [AX, L * 0.22]]);
      turn('RightForeArm', [[AX, -0.35]]);
      // 몸통: 발 디딜 때 살짝 내려앉고 좌우로 흔들림
      if (bones.Hips) bones.Hips.position.y = hipsY - Math.abs(c) * hipsY * 0.035;
      turn('Spine', [[AZ, s * 0.04], [AY, s * 0.06]]);
      // 둘러보기: 천천히 좌우를 살피고, 가끔 기지 쪽을 오래 봄
      var base = Math.atan2(-2 - pos.x, -2 - pos.z) - yaw; base = Math.atan2(Math.sin(base), Math.cos(base));
      var wantLook = Math.sin(t * 0.17) * 0.55 + Math.max(0, Math.sin(t * 0.05)) * Math.max(-1.1, Math.min(1.1, base)) * 0.8;
      look += (wantLook - look) * Math.min(1, dt * 0.9);
      pitch = -0.1 + Math.sin(t * 0.11) * 0.05;
      turn('Head', [[AY, look * 0.6]]);
      turn('Spine1', [[AY, look * 0.25]]);
      // 발 디딤: 걸음마다 한 번 (발자국 · 눈가루 · 화면 흔들림)
      var step = Math.floor(phase / Math.PI);
      if (step !== lastStep) {
        lastStep = step;
        var side = (step % 2 ? 1 : -1) * 0.9, fx = pos.x + Math.cos(yaw) * side, fz = pos.z - Math.sin(yaw) * side;
        stamp(fx, fz, yaw); kick(fx, S.height(fx, fz), fz); shake = 1;
      }
      shake = Math.max(0, shake - dt * 3.2);
      // 눈가루 움직임
      for (var p = 0; p < puffN; p++) {
        if (puffLife[p] <= 0) continue;
        puffLife[p] -= dt * 1.1;
        puffVel[p * 3 + 1] -= 3.2 * dt;
        puffPos[p * 3] += puffVel[p * 3] * dt; puffPos[p * 3 + 1] += puffVel[p * 3 + 1] * dt; puffPos[p * 3 + 2] += puffVel[p * 3 + 2] * dt;
        if (puffLife[p] <= 0) puffPos[p * 3 + 1] = -999;
      }
      puffGeo.attributes.position.needsUpdate = true;

      root.updateMatrixWorld(true);
      if (FEED && !TP) {
        // 머리 카메라: 머리 뼈 위치에서 조금 앞, 걷는 흔들림 + 발 디딜 때 짧은 충격
        bones.Head.getWorldPosition(headW);
        var dir = yaw + look * 0.85;
        fwd.set(Math.sin(dir), 0, Math.cos(dir));
        S.camera.position.copy(headW).addScaledVector(fwd, 0.55);
        S.camera.position.y += 0.25 - shake * shake * 0.12;
        // 카메라는 -Z 를 보므로 방향에 π 를 더함 (YXZ: 좌우 → 위아래 → 기울기)
        S.camera.rotation.set(pitch + shake * shake * 0.02, dir + Math.PI, Math.sin(phase) * 0.012, 'YXZ');
      } else if (TP) {
        var back = new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        S.camera.position.set(pos.x, gy + 7, pos.z).addScaledVector(back, 13);
        S.camera.lookAt(pos.x, gy + 3, pos.z);
      }
      // 감시 화면 정보 (방위 · 속도 · 좌표)
      if (window.__feedHud) window.__feedHud({ heading: ((dir2deg(yaw + look * 0.85)) + 360) % 360, speed: SPEED * 3.6, x: pos.x, z: pos.z, alt: gy });
    });
    function dir2deg(r) { return Math.round(r * 180 / Math.PI); }
    if (window.parent !== window) window.parent.postMessage({ rss: 'feed-ready' }, '*');
  }
})();
