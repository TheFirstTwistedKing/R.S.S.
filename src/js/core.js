/* 공용: DOM 도우미, 암호화, 저장소, 효과음 */
(function () {
  'use strict';
  var R = window.RSS = {};

  /* ── 언어: 기본 한국어, 'Eng' 명령으로 영어. 선택은 이 PC 에 기억 ── */
  R.lang = (function () { try { return localStorage.getItem('rss-lang') === 'en' ? 'en' : 'ko'; } catch (e) { return 'ko'; } })();
  R.T = function (ko, en) { return R.lang === 'en' ? en : ko; };
  var langListeners = [];
  R.onLang = function (fn) { langListeners.push(fn); };
  R.setLang = function (l) {
    R.lang = l === 'en' ? 'en' : 'ko';
    try { localStorage.setItem('rss-lang', R.lang); } catch (e) {}
    document.documentElement.lang = R.lang;
    langListeners.forEach(function (fn) { fn(R.lang); });
  };

  /* ── DOM ── */
  R.$ = function (s, el) { return (el || document).querySelector(s); };
  R.$$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  R.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
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
  R.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  R.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  R.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };

  R.toast = function (msg) {
    var box = R.$('#toast'), t = R.h('div', { class: 't', text: msg });
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };

  /* ── 유형 / 보안등급 ── */
  // name 은 현재 언어에 따라 바뀜
  var bi = function (o) { Object.defineProperty(o, 'name', { get: function () { return R.lang === 'en' ? o.en : o.ko; } }); return o; };
  R.TYPES = [
    bi({ id: 'character', code: 'CHR', ko: '인물', en: 'Character' }),
    bi({ id: 'organization', code: 'ORG', ko: '조직', en: 'Organization' }),
    bi({ id: 'location', code: 'LOC', ko: '장소', en: 'Location' }),
    bi({ id: 'item', code: 'ITM', ko: '물품', en: 'Item' }),
    bi({ id: 'planet', code: 'PLN', ko: '행성', en: 'Planet' })
  ];
  R.type = function (id) { return R.TYPES.find(function (t) { return t.id === id; }) || R.TYPES[0]; };
  R.CLEAR = [
    bi({ n: 0, ko: '공개', en: 'Unclassified', code: 'UNCLASSIFIED' }),
    bi({ n: 1, ko: '대외비', en: 'Restricted', code: 'RESTRICTED' }),
    bi({ n: 2, ko: '기밀', en: 'Secret', code: 'SECRET' }),
    bi({ n: 3, ko: '극비', en: 'Top secret', code: 'TOP SECRET' })
  ];
  R.STATUS = ['활동', '잠적', '구금', '사망', '불명', '해당 없음'];

  /* ── 암호화 (PBKDF2-SHA256 → AES-GCM 256) ── */
  var ITER = 310000;
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var bin = atob(s), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  function deriveKey(code, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode('RSS::' + code), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  R.crypto = {
    newKey: function (code) {
      var salt = crypto.getRandomValues(new Uint8Array(16));
      return deriveKey(code, salt, ITER).then(function (key) { return { key: key, salt: salt, iter: ITER }; });
    },
    keyFor: function (code, envelope) { return deriveKey(code, unb64(envelope.salt), envelope.iter || ITER); },
    seal: function (k, obj) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k.key, enc.encode(JSON.stringify(obj))).then(function (ct) {
        return JSON.stringify({ app: 'RSS', v: 1, kdf: 'PBKDF2-SHA256', iter: k.iter, salt: b64(k.salt), iv: b64(iv), ct: b64(ct) });
      });
    },
    open: function (key, envelope) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv) }, key, unb64(envelope.ct)).then(function (pt) { return JSON.parse(dec.decode(pt)); });
    },
    saltOf: function (envelope) { return unb64(envelope.salt); }
  };

  /* ── 디스크 접근: Electron preload 가 있으면 파일, 없으면(브라우저 미리보기) localStorage ── */
  var bridge = window.rss || {
    readVault: function () { try { return Promise.resolve(localStorage.getItem('rss-vault')); } catch (e) { return Promise.resolve(null); } },
    writeVault: function (t) { try { localStorage.setItem('rss-vault', t); } catch (e) {} return Promise.resolve(true); },
    wipeVault: function () { try { localStorage.removeItem('rss-vault'); } catch (e) {} return Promise.resolve(true); },
    saveBackup: function (name, text) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      return Promise.resolve(name);
    },
    openBackup: function () {
      return new Promise(function (res) {
        var i = document.createElement('input'); i.type = 'file'; i.accept = '.rssvault,.json';
        i.onchange = function () { var f = i.files[0]; if (!f) return res(null); f.text().then(res); };
        i.click();
      });
    }
  };
  R.bridge = bridge;

  /* ── 데이터 모델 ── */
  R.emptyDB = function () {
    return { schema: 1, seq: 0, entities: [], links: [], events: [], logs: [], settings: { autoLock: 10 } };
  };
  R.normalize = function (d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.entities)) throw new Error('형식이 올바르지 않습니다');
    var db = R.emptyDB();
    db.seq = +d.seq || 0;
    db.entities = d.entities.filter(function (e) { return e && e.id; }).map(function (e) {
      return {
        id: String(e.id), no: +e.no || ++db.seq, type: R.type(e.type).id,
        name: String(e.name || '이름 없음'), alias: String(e.alias || ''),
        clearance: Math.max(0, Math.min(3, +e.clearance || 0)), status: String(e.status || ''),
        summary: String(e.summary || ''), body: String(e.body || ''),
        tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
        fields: Array.isArray(e.fields) ? e.fields.filter(function (f) { return f && (f.k || f.v); }).map(function (f) { return { k: String(f.k || ''), v: String(f.v || '') }; }) : [],
        image: typeof e.image === 'string' && (e.image.indexOf('data:image/') === 0 || /^lore\/[\w\-./]+\.(png|jpe?g|webp|gif)$/i.test(e.image)) ? e.image : '',
        created: +e.created || Date.now(), updated: +e.updated || Date.now()
      };
    });
    db.seq = Math.max(db.seq, db.entities.reduce(function (m, e) { return Math.max(m, e.no); }, 0));
    var ids = {}; db.entities.forEach(function (e) { ids[e.id] = 1; });
    db.links = (Array.isArray(d.links) ? d.links : []).filter(function (l) { return l && ids[l.a] && ids[l.b] && l.a !== l.b; })
      .map(function (l) { return { id: String(l.id || R.uid()), a: String(l.a), b: String(l.b), label: String(l.label || '') }; });
    db.events = (Array.isArray(d.events) ? d.events : []).filter(Boolean).map(function (v) {
      return { id: String(v.id || R.uid()), date: String(v.date || ''), title: String(v.title || '제목 없음'), desc: String(v.desc || ''),
        major: !!v.major, entities: (Array.isArray(v.entities) ? v.entities : []).map(String).filter(function (id) { return ids[id]; }) };
    });
    db.logs = (Array.isArray(d.logs) ? d.logs : []).filter(function (x) { return x && x.t && x.m; }).slice(-LOG_MAX)
      .map(function (x) { return { t: +x.t, l: ['SEC', 'DATA', 'SYS', 'WARN'].indexOf(x.l) >= 0 ? x.l : 'SYS', m: String(x.m) }; });
    if (d.settings && typeof d.settings.autoLock === 'number') db.settings.autoLock = Math.max(0, Math.min(120, d.settings.autoLock));
    return db;
  };

  /* ── 시스템 로그: 보관소 안에 암호화되어 함께 저장. 잠긴 동안 생긴 기록(접속 실패 등)은 대기열에 두었다가 해제 후 기록 ── */
  var LOG_MAX = 400, pendingLogs = [], logListeners = [];
  R.log = function (level, msg) {
    var x = { t: Date.now(), l: level, m: msg };
    var db = R.store && R.store.db;
    if (!db) { pendingLogs.push(x); return; }
    db.logs.push(x);
    if (db.logs.length > LOG_MAX) db.logs.splice(0, db.logs.length - LOG_MAX);
    logListeners.forEach(function (fn) { fn(x); });
    R.store.save();
  };
  R.onLog = function (fn) { logListeners.push(fn); };
  R.flushPendingLogs = function () { var q = pendingLogs; pendingLogs = []; q.forEach(function (x) { R.log(x.l, x.m); }); };

  /* ── 아카이브 = 앱에 내장된 세계관 문서 (lore.js). 열람 전용: 앱 안에서 만들거나 고칠 수 없음 ── */
  var loreCache = null;
  Object.defineProperty(R, 'A', { get: function () {
    if (!loreCache) {
      try { var n = R.normalize(window.RSSLore || { entities: [] }); loreCache = { entities: n.entities, links: n.links, events: n.events }; }
      catch (e) { console.error(e); loreCache = { entities: [], links: [], events: [] }; }
    }
    return loreCache;
  } });

  R.code = function (e) { return e.sealed ? e.code : R.type(e.type).code + '-' + String(e.no).padStart(4, '0'); };

  /* ── 봉인 문서: 앱에 내장된 미완성 문서. 목록에는 보이지만 열람 승인이 없어 내용은 열리지 않음 ── */
  R.SEALED = [
    { sealed: true, id: 'sealed-iarchi', code: 'PLN-IA01', type: 'planet', ko: 'I Archi(이아키) 행성', en: 'Planet I Archi', alias: 'I ARCHI',
      clearance: 3, statusKo: '미완성 · 승인 대기', statusEn: 'Draft · awaiting approval', match: /(i\s*-?\s*archi|이아키|아이\s*아키)/i }
  ];
  R.SEALED.forEach(function (o) {
    Object.defineProperty(o, 'name', { get: function () { return R.lang === 'en' ? o.en : o.ko; } });
    Object.defineProperty(o, 'status', { get: function () { return R.lang === 'en' ? o.statusEn : o.statusKo; } });
  });
  R.sealedIn = function (text) { return R.SEALED.filter(function (s) { return s.match.test(text); }); };

  /* ── 이전 버전의 '예시 기록' 정리: 예시와 이름·요약이 정확히 같은 것만 지움 (사용자가 만든 기록은 그대로) ── */
  // 예시로 만들었던 이름 · 유형 조합 (요약을 고쳤더라도 지움: 사용자 요청 "아카이브에 예시 전부 없애줘")
  var SAMPLE_FP = [['한서윤', 'character'], ['북부 지부', 'organization'], ['미상의 접촉자', 'character'], ['항만 7번 창고', 'location'], ['보안 등급 체계', 'lore']];
  var SAMPLE_EV = ['KESTREL 귀환', '항만 7번 창고 접촉', '북부 지부 감시 작전 승인'];
  R.purgeSamples = function (db) {
    var gone = {};
    db.entities = db.entities.filter(function (e) {
      var hit = SAMPLE_FP.some(function (f) { return e.name === f[0] && e.type === f[1]; });
      if (hit) gone[e.id] = 1;
      return !hit;
    });
    var n = Object.keys(gone).length, before = db.events.length;
    db.links = db.links.filter(function (l) { return !gone[l.a] && !gone[l.b]; });
    db.events = db.events.filter(function (v) { return SAMPLE_EV.indexOf(v.title) < 0; });
    db.events.forEach(function (v) { v.entities = v.entities.filter(function (id) { return !gone[id]; }); });
    return n + (before - db.events.length);
  };

  var store = R.store = { db: null, key: null, envelope: null, dirty: false };
  store.load = function () {
    return bridge.readVault().then(function (t) {
      if (!t) return null;
      try { return JSON.parse(t); } catch (e) { return { broken: true }; }
    });
  };
  store.unlock = function (code, envelope) {
    return R.crypto.keyFor(code, envelope).then(function (key) {
      return R.crypto.open(key, envelope).then(function (data) {
        store.key = { key: key, salt: R.crypto.saltOf(envelope), iter: envelope.iter };
        store.db = R.normalize(data);
        return store.db;
      });
    });
  };
  store.create = function (code) {
    return R.crypto.newKey(code).then(function (k) { store.key = k; store.db = R.emptyDB(); return store.flush(); });
  };
  store.flush = function () {
    if (!store.key || !store.db) return Promise.resolve();
    store.dirty = false;
    return R.crypto.seal(store.key, store.db).then(function (text) { return bridge.writeVault(text); })
      .catch(function (e) { console.error(e); R.toast('저장 실패: ' + e.message); });
  };
  var later = R.debounce(store.flush, 400);
  store.save = function () { store.dirty = true; later(); };
  store.rekey = function (code) {
    return R.crypto.newKey(code).then(function (k) { store.key = k; return store.flush(); });
  };
  store.lock = function () {
    var p = store.dirty ? store.flush() : Promise.resolve();
    return p.then(function () { store.key = null; store.db = null; });
  };

  /* ── 효과음: WebAudio 사각파 짧은 비프. 기본 꺼짐, 메인 화면 SOUND 버튼으로만 조절 ── */
  var ctx = null, noiseBuf = null, master = null;
  R.sound = {
    // 소리는 항상 켜짐 (끄는 버튼 없음)
    on: true,
    beep: function (freq, dur, vol, when) {
      if (!this.on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol || 0.035, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* 소리 실패는 무시 */ }
    },
    key: function () { this.stroke('key'); },
    /* 마우스 클릭음 '달칵': 누를 때 날카로운 마이크로스위치 소리, 뗄 때 더 작고 높은 반동음 */
    click: function (up) {
      if (!this.on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        if (!noiseBuf) this.stroke('init');
        if (!master) return;
        var t = ctx.currentTime + 0.001, v = 0.92 + Math.random() * 0.16;
        var burst = function (type, freq, q, peak, decay) {
          var src = ctx.createBufferSource(); src.buffer = noiseBuf;
          var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.0012); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          src.connect(f); f.connect(g); g.connect(master);
          src.start(t, Math.random() * 0.15); src.stop(t + decay + 0.01);
        };
        if (!up) {
          burst('highpass', 3800 * v, 0.7, 0.42, 0.012);   // 딸
          burst('bandpass', 1900 * v, 3.5, 0.5, 0.028);    // 칵 (스위치 몸체 공명)
          var o = ctx.createOscillator(), og = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = 2900 * v;
          og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.06, t + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
          o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.03);
        } else {
          burst('highpass', 4600 * v, 0.7, 0.18, 0.009);
          burst('bandpass', 2400 * v, 4, 0.2, 0.018);
        }
      } catch (e) { /* 소리 실패는 무시 */ }
    },
    /* 타자음: 녹음 파일 없이 코드로 합성한 플라스틱 키보드 소리.
       - 몸통: 대역 필터를 거친 잡음(낮은 '톡')  - 윗면: 높은 대역 잡음(딸깍)  - 바닥: 짧은 저음 사인파(무게감)
       - 키를 뗄 때 나는 작은 플라스틱 반동음
       누를 때마다 높낮이·세기를 조금씩 흔들어 기계음처럼 똑같이 들리지 않게 함 */
    stroke: function (kind) {
      if (!this.on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        if (!noiseBuf) {
          noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
          var ch = noiseBuf.getChannelData(0);
          for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
          master = ctx.createGain(); master.gain.value = 0.55;
          var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
          master.connect(comp); comp.connect(ctx.destination);
        }
        if (kind === 'init') return;   // 공용 잡음 버퍼만 준비
        var t = ctx.currentTime + 0.002, v = 0.9 + Math.random() * 0.2;
        var heavy = kind === 'enter' || kind === 'space';
        var noise = function (type, freq, q, peak, decay, at) {
          var src = ctx.createBufferSource(); src.buffer = noiseBuf;
          src.playbackRate.value = 0.8 + Math.random() * 0.4;
          var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + 0.0025); g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
          src.connect(f); f.connect(g); g.connect(master);
          src.start(at, Math.random() * 0.15); src.stop(at + decay + 0.02);
        };
        noise('bandpass', (heavy ? 330 : 560) * v, 1.3, heavy ? 0.9 : 0.75, heavy ? 0.085 : 0.06, t);   // 몸통
        noise('highpass', 2600 * v, 0.8, heavy ? 0.16 : 0.22, 0.016, t);                                 // 윗면 딸깍
        var o = ctx.createOscillator(), og = ctx.createGain();                                           // 바닥 저음
        o.type = 'sine'; o.frequency.setValueAtTime((heavy ? 120 : 165) * v, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
        og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(heavy ? 0.35 : 0.22, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.08);
        noise('bandpass', 1500 * v, 2, 0.07, 0.02, t + 0.065 + Math.random() * 0.02);                  // 뗄 때 반동음
      } catch (e) { /* 소리 실패는 무시 */ }
    },
    type: (function () { var last = 0; return function () { var n = performance.now(); if (n - last < 45) return; last = n; this.beep(2600 + Math.random() * 400, 0.01, 0.008); }; })(),
    power: function () { this.beep(70, 0.35, 0.06); this.beep(140, 0.2, 0.025, 0.05); this.beep(3200, 0.25, 0.006, 0.12); },
    out: function () { this.beep(1760, 0.02, 0.012); },
    err: function () { this.beep(220, 0.12, 0.04); },
    tick: function () { this.beep(2200, 0.012, 0.012); },
    deny: function () { this.beep(150, 0.18, 0.05); this.beep(120, 0.22, 0.05, 0.16); },
    grant: function () { var s = this; [660, 880, 1320].forEach(function (f, i) { s.beep(f, 0.07, 0.03, i * 0.08); }); },
    nav: function () { this.beep(880, 0.03, 0.02); },
    /* 순찰 로봇 발소리 (감시 영상의 마이크로 들리는 소리, 코드로 합성)
       - 쿵: 무거운 금속 발이 땅을 디디는 저음  - 뽀득: 눈이 눌리는 잡음 알갱이 몇 개
       - 철컥: 발목 관절의 짧은 금속음  - 위잉: 다음 다리를 드는 서보 모터 소리 (작게) */
    mechStep: function (side) {
      if (!this.on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        if (!noiseBuf) this.stroke('init');
        if (!master) return;
        var t = ctx.currentTime + 0.005, v = 0.92 + Math.random() * 0.16, pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        var out = ctx.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 5200;   // 카메라 마이크 느낌으로 윗소리를 조금 깎음
        var bus = ctx.createGain(); bus.gain.value = 0.85;
        bus.connect(out); if (pan) { pan.pan.value = (side || 0) * 0.25; out.connect(pan); pan.connect(master); } else out.connect(master);
        // 쿵
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(78 * v, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.22);
        og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.75, t + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.32);
        var noise = function (type, freq, q, peak, decay, at, rate) {
          var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rate || 1;
          var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
          src.connect(f); f.connect(g); g.connect(bus); src.start(at, Math.random() * 0.1); src.stop(at + decay + 0.02);
        };
        noise('lowpass', 420 * v, 0.7, 0.5, 0.16, t, 0.6);                               // 쿵의 몸통
        for (var i = 0; i < 5; i++) noise('bandpass', (900 + Math.random() * 1400) * v, 2.2, 0.18 + Math.random() * 0.12, 0.03 + Math.random() * 0.03, t + 0.01 + i * 0.022 + Math.random() * 0.012);   // 뽀득
        noise('bandpass', 3100 * v, 6, 0.12, 0.05, t + 0.004);                           // 철컥 (금속)
        var m = ctx.createOscillator(), mg = ctx.createGain(), mf = ctx.createBiquadFilter();   // 위잉
        m.type = 'sawtooth'; m.frequency.setValueAtTime(210 * v, t + 0.12); m.frequency.linearRampToValueAtTime(320 * v, t + 0.42);
        mf.type = 'bandpass'; mf.frequency.value = 900; mf.Q.value = 1.4;
        mg.gain.setValueAtTime(0.0001, t + 0.12); mg.gain.linearRampToValueAtTime(0.035, t + 0.2); mg.gain.linearRampToValueAtTime(0.0001, t + 0.46);
        m.connect(mf); mf.connect(mg); mg.connect(bus); m.start(t + 0.12); m.stop(t + 0.5);
      } catch (e) { /* 소리 실패는 무시 */ }
    }
  };

  /* ── 이미지: 정사각에 가깝게 잘라 작은 해상도로 줄여 저장(픽셀 느낌 + 용량 절약) ── */
  R.shrinkImage = function (file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var W = 120, H = 146, r = Math.max(W / img.width, H / img.height);
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        var w = img.width * r, h = img.height * r;
        g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/png'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없습니다')); };
      img.src = url;
    });
  };
})();
