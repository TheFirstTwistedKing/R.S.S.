/* 종이 서류 만들기: 작성용(Registry) · 읽기용(Judgement Operation) 모두 같은 항목 정의(schema.js)로 그림 */
(function (root) {
  'use strict';
  var SC = root.RSSSchema;
  function h(tag, a) {
    var el = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) (function add(c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); })(arguments[i]);
    return el;
  }

  /* 펜 사각 소리 (코드로 합성 · 항상 켜짐) */
  var ac = null, nb = null;
  function pen(kind) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      if (!nb) { nb = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate); var d = nb.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = nb; s.playbackRate.value = 0.8 + Math.random() * 0.5;
      if (kind === 'stamp') { f.type = 'lowpass'; f.frequency.value = 500; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); }
      else if (kind === 'paper') { f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); }
      else { f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 1600; f.Q.value = 1.8; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.04); }
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t, Math.random() * 0.2); s.stop(t + 0.4);
      if (kind === 'stamp') { var o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.6, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(og); og.connect(ac.destination); o.start(t); o.stop(t + 0.25); }
    } catch (e) {}
  }

  /* 손으로 그리는 칸 (초상 그리기 · 서명) */
  function drawPad(cv, ink, width, onChange) {
    var g = cv.getContext('2d'), down = false, last = null, k = 2;
    function fit() { var r = cv.getBoundingClientRect(); if (!r.width) return; var w = Math.round(r.width * k), hh = Math.round(r.height * k); if (cv.width !== w) { var old = cv.width ? cv.toDataURL() : null; cv.width = w; cv.height = hh; if (old) { var im = new Image(); im.onload = function () { g.drawImage(im, 0, 0, w, hh); }; im.src = old; } } }
    setTimeout(fit, 0); addEventListener('resize', fit);
    function pt(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * k, (e.clientY - r.top) * k, e.pressure || 0.5]; }
    cv.addEventListener('pointerdown', function (e) { fit(); down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return; var p = pt(e);
      g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = width * k * (0.7 + p[2] * 0.6);
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p;
      if (Math.random() < 0.25) pen();
    });
    var up = function () { if (down) { down = false; onChange && onChange(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return { clear: function () { g.clearRect(0, 0, cv.width, cv.height); onChange && onChange(); }, empty: function () { var d = g.getImageData(0, 0, cv.width, cv.height).data; for (var i = 3; i < d.length; i += 16) if (d[i]) return false; return true; },
      data: function (type, q) { return cv.toDataURL(type || 'image/png', q); }, fit: fit };
  }

  /* 사진 → 360×480 JPEG (Firestore 문서 한 개 크기 안에 들어가게) */
  function photoToData(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var im = new Image(); im.onload = function () {
        var W = 360, H = 480, c = document.createElement('canvas'); c.width = W; c.height = H;
        var s = Math.max(W / im.width, H / im.height), w = im.width * s, hh = im.height * s;
        var g = c.getContext('2d'); g.fillStyle = '#E6DCC4'; g.fillRect(0, 0, W, H); g.drawImage(im, (W - w) / 2, (H - hh) / 2, w, hh);
        res(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = rej; im.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  function head(title, sub, no) {
    return h('div', { class: 'pp-head' },
      h('div', null, h('div', { class: 'pp-org' }, 'R.S.S. · LEVIATHAN REGISTRY'), h('h1', { class: 'pp-title' }, title), h('div', { class: 'pp-sub' }, sub)),
      h('div', { class: 'pp-no' }, '접수 번호', h('b', null, no || '—')));
  }

  /* ── 작성용 서류 ── data: 이전에 적던 내용 · onChange(data) */
  function editor(data, onChange) {
    data = data || {};
    var paper = h('div', { class: 'paper' }), bad = {};
    var save = function () { onChange && onChange(data); };
    paper.appendChild(head('인물 등록 신청서', '리바이어던 등록청 제출용 · 펜으로 또박또박 적어 주십시오. 빨간 점(•)은 꼭 적어야 하는 칸입니다.', data._no));
    SC.SECTIONS.forEach(function (sec) {
      var grid = h('div', { class: 'pp-grid' });
      paper.appendChild(h('section', { class: 'pp-sec' }, h('div', { class: 'pp-sec-h' }, h('i', null, sec.no), h('b', null, sec.t)), grid));
      sec.f.forEach(function (f) {
        var wrap = h('label', { class: 'pp-f' + (f.half ? ' half' : ''), 'data-k': f.k }, h('span', { class: 'pp-l' }, f.t, f.req ? h('span', { class: 'req' }, '•') : null));
        var el;
        if (f.type === 'long') { el = h('textarea', { class: 'pp-ta', rows: '3', placeholder: f.ph || '' }); el.value = data[f.k] || ''; }
        else if (f.type === 'nation') {
          el = h('select', { class: 'pp-sel' }, h('option', { value: '' }, '— 출신 국가 고르기 —'),
            SC.NATIONS.map(function (g) { return h('optgroup', { label: g.era }, g.list.map(function (n) { return h('option', { value: n }, n); })); }));
          el.value = data[f.k] || '';
        } else if (f.type === 'clr' || f.type === 'status') {
          var opts = f.type === 'clr' ? SC.CLR : SC.STATUS; el = h('div', { class: 'pp-pick' });
          wrap = h('div', { class: 'pp-f' + (f.half ? ' half' : ''), 'data-k': f.k }, wrap.firstChild, el);
          opts.forEach(function (o) { el.appendChild(h('button', { type: 'button', class: data[f.k] === o ? 'on' : '', onclick: function () { data[f.k] = o; [].forEach.call(el.children, function (b) { b.classList.toggle('on', b.textContent === o); }); pen(); wrap.classList.remove('pp-bad'); save(); } }, o)); });
          grid.appendChild(wrap); return;
        } else if (f.type === 'stats') {
          data.stats = data.stats || SC.STATS.map(function () { return 5; });
          el = h('div', { class: 'pp-stats' });
          wrap = h('div', { class: 'pp-f', 'data-k': f.k }, wrap.firstChild, el);
          SC.STATS.forEach(function (s, i) {
            var dots = h('span', { class: 'pp-dots' }), val = h('b', null, String(data.stats[i]));
            for (var n = 1; n <= 10; n++) (function (n) { var d = h('i', { style: '--r:' + ((n * 37) % 11 - 5) + 'deg', onclick: function () { data.stats[i] = n; paint(); pen(); save(); } }); dots.appendChild(d); })(n);
            function paint() { [].forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j < data.stats[i]); }); val.textContent = String(data.stats[i]); }
            paint(); el.appendChild(h('div', { class: 'pp-stat' }, h('span', null, s), dots, val));
          });
          grid.appendChild(wrap); return;
        } else if (f.type === 'timeline' || f.type === 'rels') {
          var cols = f.type === 'timeline' ? [['연도 · 날짜', 'c2'], ['있었던 일']] : [['이름', 'c3'], ['관계'], ['메모']];
          data[f.k] = data[f.k] || [cols.map(function () { return ''; })];
          el = h('div', { class: 'pp-rows' });
          wrap = h('div', { class: 'pp-f', 'data-k': f.k }, wrap.firstChild, el);
          var draw = function () {
            el.innerHTML = '';
            data[f.k].forEach(function (row, ri) {
              var r = h('div', { class: 'pp-row ' + cols[0][1] });
              cols.forEach(function (c, ci) { var inp = h('input', { class: 'pp-in', placeholder: c[0] }); inp.value = row[ci] || ''; inp.addEventListener('input', function () { row[ci] = inp.value; pen(); save(); }); r.appendChild(inp); });
              r.appendChild(h('button', { class: 'pp-x', type: 'button', title: '줄 지우기', onclick: function () { data[f.k].splice(ri, 1); if (!data[f.k].length) data[f.k].push(cols.map(function () { return ''; })); draw(); save(); } }, '×'));
              el.appendChild(r);
            });
            el.appendChild(h('button', { class: 'pp-add', type: 'button', onclick: function () { data[f.k].push(cols.map(function () { return ''; })); draw(); pen('paper'); save(); } }, '+ 한 줄 더'));
          };
          draw(); grid.appendChild(wrap); return;
        } else if (f.type === 'portrait') {
          var frame = h('div', { class: 'pp-frame' }), file = h('input', { type: 'file', accept: 'image/*', hidden: true });
          var show = function () { frame.innerHTML = ''; if (data._portrait) frame.appendChild(h('img', { src: data._portrait, alt: '초상' })); else frame.appendChild(h('em', null, '사진을 붙이거나\n직접 그리십시오')); };
          var drawMode = function () {
            frame.innerHTML = ''; var cv = h('canvas'); frame.appendChild(cv);
            var pad = drawPad(cv, '#1F2A44', 2.2, function () { var c = document.createElement('canvas'); c.width = 360; c.height = 480; var g = c.getContext('2d'); g.fillStyle = '#E6DCC4'; g.fillRect(0, 0, 360, 480); g.drawImage(cv, 0, 0, 360, 480); data._portrait = c.toDataURL('image/jpeg', 0.85); save(); });
            setTimeout(pad.fit, 0);
          };
          file.addEventListener('change', function () { if (!file.files[0]) return; photoToData(file.files[0]).then(function (d) { data._portrait = d; show(); pen('paper'); save(); }); });
          el = h('div', { class: 'pp-photo' }, frame, h('div', { class: 'pp-photo-btns' },
            h('button', { class: 'pp-btn', type: 'button', onclick: function () { file.click(); } }, '사진 붙이기'),
            h('button', { class: 'pp-btn', type: 'button', onclick: function () { data._portrait = ''; drawMode(); } }, '직접 그리기'),
            h('button', { class: 'pp-btn', type: 'button', onclick: function () { data._portrait = ''; show(); save(); } }, '지우기'), file,
            h('span', { class: 'pp-l' }, '사진은 360 × 480 크기로 줄여서 제출됩니다')));
          show();
          wrap = h('div', { class: 'pp-f', 'data-k': f.k }, wrap.firstChild, el); grid.appendChild(wrap); return;
        } else if (f.type === 'sign') {
          var box = h('div', { class: 'pp-sign' }), cv2 = h('canvas'), hint = h('em', null, '여기에 서명하십시오');
          box.appendChild(cv2); box.appendChild(hint);
          var sp = drawPad(cv2, '#1F2A44', 2.4, function () { data._sign = sp.empty() ? '' : sp.data('image/png'); hint.hidden = !!data._sign; wrap.classList.remove('pp-bad'); save(); });
          if (data._sign) { var im = new Image(); im.onload = function () { sp.fit(); cv2.getContext('2d').drawImage(im, 0, 0, cv2.width, cv2.height); hint.hidden = true; }; im.src = data._sign; }
          wrap = h('div', { class: 'pp-f', 'data-k': f.k }, wrap.firstChild, box, h('button', { class: 'pp-btn', type: 'button', style: 'margin-top:8px;align-self:flex-start', onclick: function () { sp.clear(); } }, '서명 지우기'));
          grid.appendChild(wrap); return;
        } else { el = h('input', { class: 'pp-in', placeholder: f.ph || '', autocomplete: 'off' }); el.value = data[f.k] || ''; }
        var on = function () { data[f.k] = el.value; el.classList.remove('inked'); void el.offsetWidth; el.classList.add('inked'); wrap.classList.remove('pp-bad'); save(); };
        el.addEventListener('input', function () { pen(); on(); }); el.addEventListener('change', on);
        wrap.appendChild(el); grid.appendChild(wrap);
      });
    });
    var stampEl = h('div', { class: 'pp-stamp', hidden: true });
    paper.appendChild(stampEl);
    return {
      el: paper, data: data,
      /* 필수 칸 검사: 빠진 칸 이름 목록 */
      missing: function () {
        var out = [];
        SC.all().forEach(function (f) {
          if (!f.req) return;
          var v = f.type === 'sign' ? data._sign : data[f.k];
          var ok = v && String(v).trim();
          var w = paper.querySelector('[data-k="' + f.k + '"]');
          if (w) w.classList.toggle('pp-bad', !ok);
          if (!ok) out.push(f.t.replace(/ \(.*\)$/, ''));
        });
        return out;
      },
      stamp: function (text, sub, cls) { stampEl.hidden = false; stampEl.className = 'pp-stamp go ' + (cls || ''); stampEl.innerHTML = ''; stampEl.appendChild(document.createTextNode(text)); stampEl.appendChild(h('small', null, sub || '')); pen('stamp'); }
    };
  }

  /* ── 읽기용 서류 ── */
  function viewer(d, portrait, sign, opts) {
    opts = opts || {};
    var paper = h('div', { class: 'paper' });
    paper.appendChild(head('인물 등록 신청서', opts.sub || '', opts.no));
    SC.SECTIONS.forEach(function (sec) {
      var grid = h('div', { class: 'pp-grid' });
      paper.appendChild(h('section', { class: 'pp-sec' }, h('div', { class: 'pp-sec-h' }, h('i', null, sec.no), h('b', null, sec.t)), grid));
      sec.f.forEach(function (f) {
        var wrap = h('div', { class: 'pp-f' + (f.half ? ' half' : '') }, h('span', { class: 'pp-l' }, f.t));
        var v = d[f.k];
        if (f.type === 'portrait') wrap.appendChild(h('div', { class: 'pp-photo' }, h('div', { class: 'pp-frame' }, portrait ? h('img', { src: portrait, alt: '초상' }) : h('em', null, '초상 없음'))));
        else if (f.type === 'sign') wrap.appendChild(h('div', { class: 'pp-sign' }, sign ? h('img', { src: sign, alt: '서명' }) : h('em', null, '서명 없음')));
        else if (f.type === 'stats') { var st = h('div', { class: 'pp-stats' }); SC.STATS.forEach(function (s, i) { var dots = h('span', { class: 'pp-dots' }); for (var n = 1; n <= 10; n++) dots.appendChild(h('i', { class: n <= ((v || [])[i] || 0) ? 'on' : '', style: '--r:' + ((n * 37) % 11 - 5) + 'deg' })); st.appendChild(h('div', { class: 'pp-stat' }, h('span', null, s), dots, h('b', null, String((v || [])[i] || 0)))); }); wrap.appendChild(st); }
        else if (f.type === 'timeline' || f.type === 'rels') {
          var rows = (v || []).filter(function (r) { return r.some(function (x) { return x && String(x).trim(); }); });
          wrap.appendChild(h('div', { class: 'pp-v long' + (rows.length ? '' : ' empty') }, rows.length ? rows.map(function (r) { return f.type === 'timeline' ? (r[0] || '') + '   ' + (r[1] || '') : r[0] + ' — ' + (r[1] || '') + (r[2] ? ' (' + r[2] + ')' : ''); }).join('\n') : '적지 않음'));
        } else wrap.appendChild(h('div', { class: 'pp-v' + (f.type === 'long' ? ' long' : '') + (v && String(v).trim() ? '' : ' empty') }, v && String(v).trim() ? String(v) : '적지 않음'));
        grid.appendChild(wrap);
      });
    });
    if (opts.stamp) { var s = h('div', { class: 'pp-stamp go ' + (opts.stamp.cls || '') }, opts.stamp.text, h('small', null, opts.stamp.sub || '')); paper.appendChild(s); }
    return paper;
  }
  root.RSSPaper = { editor: editor, viewer: viewer, pen: pen, h: h };
})(window);
