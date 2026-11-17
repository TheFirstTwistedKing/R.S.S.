/* R.S.S. Mobile 공용: 화면 도우미 · 암호화 보관소 · 효과음 · 숫자 표시
   - 보관소는 이 휴대폰(브라우저) 안에만 저장되고, 접속 코드로 AES-GCM 256 암호화 (PBKDF2-SHA256)
   - R.S.S. 데스크톱 앱의 보관소와는 완전히 따로임 (시뮬레이션이 본 시스템에 영향을 주지 않음) */
(function () {
  'use strict';
  var M = window.RSSM = {};
  M.$ = function (s, r) { return (r || document).querySelector(s); };
  M.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  /* ── 숫자 ── */
  var nf = {};
  M.num = function (v, d) { d = d == null ? 0 : d; nf[d] = nf[d] || new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); return nf[d].format(v); };
  M.px = function (v) { return M.num(v, v >= 1000 ? 0 : v >= 100 ? 1 : v >= 10 ? 2 : 3); };          // 주가
  M.fx = function (v) { return M.num(v, v >= 1000 ? 2 : v >= 100 ? 3 : v >= 10 ? 4 : 5); };         // 환율
  M.levc = function (v) { return M.num(Math.round(v)) + ' LEVC'; };
  M.pct = function (v, d) { d = d == null ? 2 : d; var r = +v.toFixed(d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d) + '%'; };
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  M.p2 = p2;
  M.hms = function (t) { var d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); };
  M.day = function (t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };   // 이 휴대폰 시각 기준 날짜

  /* ── 글자 해독 효과 (R.S.S. 와 같은 방식: 빗금 → 왼쪽부터 글자) ── */
  var GLY = '▖▗▘▙▚▛▜▝▞▟░▒#%&';
  M.decode = function (el, text, speed) {
    text = String(text); speed = speed || 18;
    var n = Array.from(text), i = 0, id = ++M._dec;
    el.dataset.dec = id;
    return new Promise(function (res) {
      (function frame() {
        if (el.dataset.dec !== String(id)) return res();
        i += Math.max(1, n.length / speed);
        var k = Math.min(n.length, Math.floor(i));
        el.textContent = n.slice(0, k).join('') + n.slice(k, k + 6).map(function (c) { return c === ' ' ? ' ' : GLY[(Math.random() * GLY.length) | 0]; }).join('');
        if (k < n.length) requestAnimationFrame(frame); else { el.textContent = text; res(); }
      })();
    });
  };
  M._dec = 0;

  /* ── 암호화 ── */
  var ITER = 310000, enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var bin = atob(s), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  function derive(code, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode('RSSM::' + code), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  var KEY = 'rss-mobile-vault';
  var S = M.store = { key: null, salt: null, data: null, dirty: false };
  S.exists = function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
  S.create = function (code, data) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return derive(code, salt, ITER).then(function (k) { S.key = k; S.salt = salt; S.data = data; return S.flush(); });
  };
  S.unlock = function (code) {
    var env = JSON.parse(localStorage.getItem(KEY));
    return derive(code, unb64(env.salt), env.iter || ITER).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.ct)).then(function (pt) {
        S.key = k; S.salt = unb64(env.salt); S.data = JSON.parse(dec.decode(pt)); return S.data;
      });
    });
  };
  S.flush = function () {
    if (!S.key || !S.data) return Promise.resolve();
    S.dirty = false;
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, S.key, enc.encode(JSON.stringify(S.data))).then(function (ct) {
      try { localStorage.setItem(KEY, JSON.stringify({ app: 'RSS-MOBILE', v: 1, iter: ITER, salt: b64(S.salt), iv: b64(iv), ct: b64(ct) })); } catch (e) { M.toast('저장 공간이 부족합니다'); }
    });
  };
  var saveT = 0;
  S.save = function () { S.dirty = true; clearTimeout(saveT); saveT = setTimeout(S.flush, 500); };
  S.wipe = function () { try { localStorage.removeItem(KEY); } catch (e) {} };
  // 앱을 내리거나 닫을 때 바로 저장
  document.addEventListener('visibilitychange', function () { if (document.hidden && S.dirty) S.flush(); });
  window.addEventListener('pagehide', function () { if (S.dirty) S.flush(); });

  /* ── 효과음 (코드로 합성, 항상 켜짐) ── */
  var ctx = null, noise = null;
  function ac() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate); var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return ctx;
  }
  function tone(type, f0, f1, dur, vol, at) {
    var c = ac(), t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(freq, q, vol, dur, at) {
    var c = ac(), t = c.currentTime + (at || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random() * 0.1); s.stop(t + dur + 0.02);
  }
  var safe = function (fn) { return function () { try { fn.apply(null, arguments); } catch (e) {} }; };
  M.sound = {
    key: safe(function () { hiss(600 + Math.random() * 80, 1.4, 0.5, 0.05); tone('sine', 150, 70, 0.05, 0.18); }),
    tap: safe(function () { tone('square', 1760, 0, 0.02, 0.015); }),
    ok: safe(function () { [660, 880, 1320].forEach(function (f, i) { tone('square', f, 0, 0.07, 0.025, i * 0.08); }); }),
    deny: safe(function () { tone('square', 150, 0, 0.18, 0.04); tone('square', 120, 0, 0.22, 0.04, 0.16); }),
    buy: safe(function () { tone('triangle', 880, 1320, 0.09, 0.05); hiss(3000, 3, 0.15, 0.04); }),
    sell: safe(function () { tone('triangle', 1320, 660, 0.12, 0.05); hiss(2400, 3, 0.12, 0.04); }),
    plug: safe(function () { hiss(2200, 5, 0.5, 0.04); tone('sine', 120, 60, 0.08, 0.3); }),
    zap: safe(function () { hiss(5000, 0.8, 0.12, 0.08); }),
    gear: safe(function () { hiss(1800 + Math.random() * 400, 8, 0.25, 0.03); }),
    power: safe(function () { tone('sawtooth', 60, 220, 0.9, 0.05); tone('sine', 110, 440, 0.9, 0.08); [880, 1175, 1760].forEach(function (f, i) { tone('square', f, 0, 0.12, 0.02, 0.6 + i * 0.1); }); })
  };

  /* ── 안내 띠 ── */
  M.toast = function (msg) {
    var t = M.h('div', { class: 'toast' }, msg);
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  };
})();
