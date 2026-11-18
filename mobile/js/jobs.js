/* 일하기 목록: 장치 활성화 · 암호 해독 · 신호 동조 (각각 하루 한 번, 오전 12:00 에 다시 열림)
   - 암호 해독: 1~6 숫자 4자리 암호를 8번 안에 맞힘. 시도마다 ● 자리까지 맞음 / ○ 숫자만 맞음 개수를 알려 줌
     8번 안에 못 맞히면 새 암호로 다시 (실패해도 그날 다시 할 수 있음)
   - 신호 동조: 목표 파형에 내 파형(주파수 · 위상)을 맞추고, 일치도 90% 이상에서 고정 버튼을 1.5초 누름
     (휴대폰 슬라이더로 맞추기 어렵지 않게 기준 90% · 손잡이 옆 미세 조정 버튼) */
(function () {
  'use strict';
  var M = window.RSSM, h = M.h, S = M.store;
  var JOBS = [
    { id: 'device', ko: 'R.S.S. 장치 활성화', d: '전선 10개를 색 · 도형이 같은 연결부에 연결하고 톱니바퀴를 돌림', pay: 50000000 },
    { id: 'cipher', ko: '암호 해독', d: '숫자 1~6 으로 된 4자리 암호를 8번 안에 맞힘', pay: 30000000 },
    { id: 'signal', ko: '신호 동조', d: '목표 파형에 주파수 · 위상을 맞추고 신호를 고정함', pay: 30000000 }
  ];
  M.JOBS = JOBS;
  function jobs() { var d = S.data; d.jobs = d.jobs || {}; return d.jobs; }
  function done(id) { return id === 'device' ? (S.data.work && S.data.work.day === M.day()) : jobs()[id] === M.day(); }
  function untilMidnight() { var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; }
  function hhmmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return M.p2(Math.floor(s / 3600)) + ':' + M.p2(Math.floor(s / 60) % 60) + ':' + M.p2(s % 60); }

  /* 보수 지급 (모든 일 공통) */
  function pay(job, onPay) {
    if (job.id !== 'device') jobs()[job.id] = M.day();
    onPay(job.pay, job.id);
  }

  /* 일하기 탭: 목록 → 고른 일 */
  M.jobsView = function (root, onPay) {
    var undo = null, cdT = 0;
    function list() {
      if (undo) { undo(); undo = null; }
      root.innerHTML = '';
      var cd = h('b');
      root.appendChild(h('div', { class: 'jb-head' }, h('span', { class: 'wk-k' }, 'WORK'), h('span', null, '오늘의 일'), h('span', { class: 'jb-cd' }, '초기화까지 ', cd)));
      JOBS.forEach(function (j) {
        var ok = done(j.id);
        root.appendChild(h('button', { class: 'jb' + (ok ? ' done' : ''), type: 'button', onclick: function () { M.sound.tap(); open(j); } },
          h('div', { class: 'jb-t' }, h('b', null, j.ko), h('span', { class: 'jb-s' }, ok ? '완료' : '가능')),
          h('div', { class: 'jb-d' }, j.d),
          h('div', { class: 'jb-p' }, '+' + M.num(j.pay) + ' LEVC')));
      });
      root.appendChild(h('p', { class: 'note' }, '각 일은 하루 한 번 보수를 받습니다. 이 휴대폰 시각 기준 오전 12:00 (자정)에 다시 열립니다.'));
      var tick = function () { cd.textContent = hhmmss(untilMidnight()); };
      tick(); clearInterval(cdT); cdT = setInterval(tick, 1000);
    }
    function open(j) {
      clearInterval(cdT);
      root.innerHTML = '';
      root.appendChild(h('button', { class: 'jb-back', type: 'button', onclick: function () { M.sound.tap(); list(); } }, '‹ 일 목록'));
      var box = h('div'); root.appendChild(box);
      var paid = function () { pay(j, onPay); };
      if (j.id === 'device') undo = M.work(box, S.data, function (amount) { void amount; onPay(j.pay, 'device'); });
      else if (j.id === 'cipher') undo = cipher(box, j, paid);
      else undo = signal(box, j, paid);
    }
    M.workReset = function () { list(); };
    list();
    return function () { clearInterval(cdT); if (undo) undo(); };
  };

  function head(box, j, extra) {
    box.appendChild(h('div', { class: 'wk-h' }, h('span', { class: 'wk-k' }, j.id === 'cipher' ? 'CIPHER' : 'SIGNAL'), h('span', null, j.ko), extra || null));
  }
  function doneCard(box, j) {
    head(box, j);
    box.appendChild(h('p', { class: 'jb-done' }, '오늘 완료했습니다. 오전 12:00 (자정) 이후 다시 할 수 있습니다.'));
  }

  /* ── 암호 해독 ── */
  function cipher(box, j, paid) {
    if (done(j.id)) { doneCard(box, j); return null; }
    var code, tries, cur = '', MAXT = 8;
    var board = h('div', { class: 'cp-board' }), inp = h('div', { class: 'cp-in' }), pad = h('div', { class: 'cp-pad' }), msg = h('p', { class: 'cp-msg' });
    head(box, j, h('span', { class: 'cp-left' }));
    box.appendChild(h('p', { class: 'cp-rule' }, '숫자 1~6 으로 된 4자리 암호 (같은 숫자가 여러 번 나올 수 있음). ', h('b', null, '●'), ' 숫자와 자리 모두 맞음 · ', h('b', null, '○'), ' 숫자만 맞음'));
    box.appendChild(board); box.appendChild(inp); box.appendChild(msg); box.appendChild(pad);
    function reset(note) {
      code = []; for (var i = 0; i < 4; i++) code.push(1 + ((Math.random() * 6) | 0));
      tries = []; cur = ''; board.innerHTML = ''; msg.textContent = note || ''; draw();
    }
    function draw() {
      inp.innerHTML = '';
      for (var i = 0; i < 4; i++) inp.appendChild(h('div', { class: 'cp-slot' + (i < cur.length ? ' on' : i === cur.length ? ' cur' : '') }, cur[i] || ''));
      box.querySelector('.cp-left').textContent = (MAXT - tries.length) + '회 남음';
    }
    function score(g) {
      var a = 0, b = 0, cc = code.slice(), gg = g.slice();
      for (var i = 0; i < 4; i++) if (gg[i] === cc[i]) { a++; cc[i] = gg[i] = 0; }
      for (i = 0; i < 4; i++) if (gg[i]) { var k = cc.indexOf(gg[i]); if (k >= 0) { b++; cc[k] = 0; } }
      return [a, b];
    }
    function submit() {
      if (cur.length < 4) { M.sound.deny(); msg.textContent = '4자리를 모두 입력하십시오'; return; }
      var g = cur.split('').map(Number), sc = score(g);
      tries.push(g);
      var pins = ''; for (var i = 0; i < sc[0]; i++) pins += '●'; for (i = 0; i < sc[1]; i++) pins += '○'; for (i = sc[0] + sc[1]; i < 4; i++) pins += '·';
      board.appendChild(h('div', { class: 'cp-row' }, h('span', { class: 'cp-n' }, String(tries.length)), h('span', { class: 'cp-g' }, cur.split('').join(' ')), h('span', { class: 'cp-p' }, pins)));
      cur = '';
      if (sc[0] === 4) {
        M.sound.power(); msg.textContent = '해독 완료 · 암호 ' + code.join('');
        pad.innerHTML = ''; paid();
        box.appendChild(h('p', { class: 'jb-done' }, '+' + M.num(j.pay) + ' LEVC 지급 · 오늘 완료'));
        return;
      }
      M.sound.key();
      if (tries.length >= MAXT) { M.sound.deny(); return reset('8번 안에 풀지 못했습니다. 암호가 바뀌었습니다 (이전 암호 ' + code.join('') + ')'); }
      draw();
    }
    ['1', '2', '3', '4', '5', '6', 'DEL', 'OK'].forEach(function (k) {
      pad.appendChild(h('button', { class: 'key' + (/\d/.test(k) ? '' : k === 'OK' ? ' ok' : ' fn'), type: 'button', onclick: function () {
        if (k === 'OK') return submit();
        if (k === 'DEL') { if (cur) { cur = cur.slice(0, -1); M.sound.key(); } }
        else if (cur.length < 4) { cur += k; M.sound.key(); }
        draw();
      } }, k === 'OK' ? '해독' : k));
    });
    reset();
    return null;
  }

  /* ── 신호 동조 ── */
  function signal(box, j, paid) {
    if (done(j.id)) { doneCard(box, j); return null; }
    var TH = 0.9, tf = 1.5 + Math.random() * 3, tp = Math.random() * 360, f = 1, p = 0, raf = 0, holdT = 0, holdStart = 0, finished = false;
    var cv = h('canvas', { class: 'sg-cv' }), meter = h('div', { class: 'sg-meter' }, h('i')), pct = h('b');
    var sf = h('input', { type: 'range', min: '1', max: '5', step: '0.01', value: '1', class: 'sg-r' });
    var sp = h('input', { type: 'range', min: '0', max: '360', step: '1', value: '0', class: 'sg-r' });
    var hold = h('button', { class: 'btn buy sg-hold', type: 'button', disabled: true }, '신호 고정 (꾹 누르기)');
    head(box, j, h('span', { class: 'sg-pct' }, '일치 ', pct));
    box.appendChild(h('div', { class: 'sg-wrap' }, cv));
    box.appendChild(meter);
    var fine = function (el, d, set) { return h('button', { class: 'sg-f', type: 'button', onclick: function () { el.value = Math.min(+el.max, Math.max(+el.min, +el.value + d)); set(+el.value); M.sound.tap(); } }, d > 0 ? '›' : '‹'); };
    box.appendChild(h('div', { class: 'sg-l' }, h('span', null, '주파수'), fine(sf, -0.01, function (v) { f = v; }), sf, fine(sf, 0.01, function (v) { f = v; })));
    box.appendChild(h('div', { class: 'sg-l' }, h('span', null, '위상'), fine(sp, -1, function (v) { p = v; }), sp, fine(sp, 1, function (v) { p = v; })));
    box.appendChild(hold);
    box.appendChild(h('p', { class: 'note' }, '흐린 선이 목표 신호입니다. 두 손잡이로 주황 선을 겹치게 맞춘 뒤, 일치도 90% 이상에서 고정 버튼을 1.5초 동안 누르십시오. ‹ › 로 조금씩 맞출 수 있습니다.'));
    function wave(x, fr, ph) { return Math.sin(x * fr * Math.PI * 2 + ph * Math.PI / 180) * 0.8 + Math.sin(x * fr * Math.PI * 6 + ph * Math.PI / 60) * 0.12; }
    function match() { var s = 0, n = 120; for (var i = 0; i < n; i++) { var x = i / n; s += Math.abs(wave(x, f, p) - wave(x, tf, tp)); } return Math.max(0, 1 - s / n / 0.9); }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      var r = cv.getBoundingClientRect(), k = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * k), hh = Math.round(r.height * k);
      if (!w) return;
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      var g = cv.getContext('2d'); g.fillStyle = '#07080A'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(255,176,32,.08)'; g.lineWidth = 1;
      for (var gx = 0; gx <= 10; gx++) { g.beginPath(); g.moveTo(gx / 10 * w, 0); g.lineTo(gx / 10 * w, hh); g.stroke(); }
      g.beginPath(); g.moveTo(0, hh / 2); g.lineTo(w, hh / 2); g.stroke();
      var noise = finished ? 0 : 0.04;
      var draw = function (fr, ph, col, lw, nz) { g.strokeStyle = col; g.lineWidth = lw * k; g.beginPath();
        for (var i = 0; i <= 200; i++) { var x = i / 200, y = hh / 2 - (wave(x, fr, ph) + (nz ? (Math.random() - 0.5) * nz : 0)) * hh * 0.4; if (i) g.lineTo(x * w, y); else g.moveTo(x * w, y); } g.stroke(); };
      draw(tf, tp, 'rgba(243,232,210,.35)', 3, 0);
      draw(f, p, finished ? '#FFB020' : 'rgba(255,176,32,.95)', 2, noise);
      var m = match(); pct.textContent = Math.round(m * 100) + '%';
      meter.firstChild.style.width = (m * 100) + '%'; meter.classList.toggle('good', m >= TH);
      hold.disabled = finished || m < TH;
      if (holdStart && !finished) {
        if (m < TH) { holdStart = 0; hold.textContent = '신호 고정 (꾹 누르기)'; }
        else { var left = 1500 - (performance.now() - holdStart); hold.textContent = left > 0 ? '고정 중 · ' + (left / 1000).toFixed(1) + '초' : '고정 완료';
          if (left <= 0) { finished = true; holdStart = 0; M.sound.power(); paid(); box.appendChild(h('p', { class: 'jb-done' }, '+' + M.num(j.pay) + ' LEVC 지급 · 오늘 완료')); } }
      }
      void t;
    }
    sf.addEventListener('input', function () { f = +sf.value; });
    sp.addEventListener('input', function () { p = +sp.value; });
    var start = function (e) { e.preventDefault(); if (!hold.disabled) { holdStart = performance.now(); M.sound.gear(); } };
    var stop = function () { if (!finished) { holdStart = 0; hold.textContent = '신호 고정 (꾹 누르기)'; } };
    hold.addEventListener('pointerdown', start); hold.addEventListener('pointerup', stop); hold.addEventListener('pointerleave', stop); hold.addEventListener('pointercancel', stop);
    raf = requestAnimationFrame(frame);
    void holdT;
    return function () { cancelAnimationFrame(raf); };
  }
})();
