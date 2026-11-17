/* 메인 화면: 터미널 모양의 대화창 (Control · Apex) + 시스템 로그 창
   명령어 없이 말로 요청한다. 해석은 앱 안의 규칙 기반 처리(인터넷·외부 AI 사용 안 함). */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var Lx = function () { return window.RSSLines; };
  var out, input, chain = Promise.resolve(), session = null;
  var db = function () { return R.store.db; };

  /* ───────── 문구 도우미 ───────── */
  function pick(x) { return Array.isArray(x) ? x[(Math.random() * x.length) | 0] : x; }
  /* 받침에 맞는 조사 (현황판이라고 · 블루베리라고 / 열어로 · 현황으로) */
  function jong(w) { var c = String(w || '').trim().slice(-1).charCodeAt(0); if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28; return /[0-9]$/.test(w) ? ([1, 1, 0, 1, 0, 0, 1, 1, 1, 0][+String(w).slice(-1)] ? 1 : 0) : 0; }
  function jo(o) {
    var say = o.say || '', act = o.act || '', js = jong(say), ja = jong(act);
    o['라고'] = js ? '이라고' : '라고'; o['는'] = js ? '은' : '는'; o['를'] = js ? '을' : '를';
    o['로'] = ja && ja !== 8 ? '으로' : '로'; o['와'] = ja ? '과' : '와';
    return o;
  }
  function fmt(s, o) { return pick(s).replace(/\{([^}]+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); }
  function cw(ch) { var c = ch.codePointAt(0); return (c >= 0x1100 && c <= 0x115F) || (c >= 0x2E80 && c <= 0xA4CF) || (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFF60) ? 2 : 1; }
  function sw(s) { var n = 0; for (var ch of String(s)) n += cw(ch); return n; }
  function fit(s, n) {
    s = String(s == null ? '' : s); var o = '', w = 0;
    for (var ch of s) { var k = cw(ch); if (w + k > n) { o = Array.from(o).slice(0, -1).join('') + '…'; w = sw(o); break; } o += ch; w += k; }
    return o + ' '.repeat(Math.max(0, n - sw(o)));
  }
  var cellW = 0;
  function cols() {
    if (!cellW) { var m = h('span', { class: 'msg-pre', style: { visibility: 'hidden', position: 'absolute' } }, 'MMMMMMMMMM'); out.appendChild(m); cellW = m.getBoundingClientRect().width / 10 || 8; m.remove(); }
    return Math.max(24, Math.floor((out.clientWidth - 48) / cellW));
  }
  function p2(n) { return String(n).padStart(2, '0'); }
  function now() { var d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
  function scroll() { out.scrollTop = out.scrollHeight; }

  /* ───────── 출력: 말풍선 대신 터미널 줄 ─────────
     who: 'user' | 'control' | 'apex'   to: 'USER' | 'APEX' | 'CONTROL' */
  var WHO = { user: 'USER', control: 'CONTROL', apex: 'APEX' };
  function shell(who, to) {
    var internal = (who === 'control' && to === 'APEX') || (who === 'apex' && to === 'CONTROL');
    var body = h('div', { class: 'msg-b' });
    var wrap = h('div', { class: 'msg msg-' + who + (internal ? ' msg-int' : '') },
      h('div', { class: 'msg-h' }, h('span', { class: 'who' }, WHO[who]), to ? h('span', { class: 'to' }, '→ ' + to) : null, h('span', { class: 'ts' }, now())),
      body);
    out.appendChild(wrap);
    while (out.children.length > 600) out.removeChild(out.firstChild);
    scroll();
    return { wrap: wrap, body: body };
  }
  function typing(who, ms) {
    return new Promise(function (res) {
      var t = h('div', { class: 'msg-typing msg-' + who }, h('span', { class: 'who' }, WHO[who]), h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', { class: 'lbl' }, who === 'apex' ? 'PROCESSING' : 'TYPING'));
      out.appendChild(t); scroll();
      setTimeout(function () { t.remove(); res(); }, ms);
    });
  }
  /* 글 안의 파일 코드는 누르면 열람, ||가림|| 은 검은 막대 */
  var CODE_RE = /\b(CHR|ORG|LOC|ITM|PLN)-\d{4}\b/g;
  function enrich(el, text) {
    el.textContent = '';
    var re = /\|\|([\s\S]+?)\|\||\b(?:CHR|ORG|LOC|ITM|PLN)-\d{4}\b/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) {
        var r = h('span', { class: 't-red', title: '클릭하여 열람' }, m[1]);
        r.addEventListener('click', function () { this.classList.toggle('show'); R.sound.key(); });
        el.appendChild(r);
      } else {
        var code = m[0];
        el.appendChild(h('span', { class: 't-link', onclick: function () { send(code + ' 보여줘'); } }, code));
      }
      last = re.lastIndex;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
  function plain(text) { return text.replace(/\|\|([\s\S]+?)\|\|/g, function (m, a) { return '█'.repeat(Math.max(2, Array.from(a).length)); }); }

  /* 메시지를 대기열에 넣음: 입력 중 표시 → 글자 해독 → (데이터 블록이 있으면 줄마다 차례로 해독) */
  function say(who, text, o) {
    o = o || {}; text = pick(text);
    chain = chain.then(function () {
      var wait = o.wait != null ? o.wait : Math.min(900, 260 + Array.from(text || '').length * 14);
      return typing(who, wait).then(function () {
        var s = shell(who, o.to);
        R.sound.out();
        var p = text ? R.decodeP(s.body, plain(text), { speed: 18 }).then(function () { enrich(s.body, text); scroll(); }) : Promise.resolve();
        return p.then(function () {
          if (!o.pre || !o.pre.length) return;
          var pre = h('div', { class: 'msg-pre' });
          s.wrap.appendChild(pre);
          var last = Promise.resolve();
          o.pre.forEach(function (row, i) {
            var line = typeof row === 'string' ? { t: row } : row;
            var el = h('div', { class: 'pl ' + (line.c || '') });
            el.textContent = plain(line.t) || ' ';
            pre.appendChild(el);
            last = R.decodeP(el, plain(line.t) || ' ', { delay: Math.min(i * 40, 1200), speed: 10 }).then(function () { enrich(el, line.t || ' '); });
          });
          scroll();
          return last.then(scroll);
        });
      });
    });
    return chain;
  }
  var C = function (text, o) {
    o = o || {}; o.to = o.to || 'USER';
    var nm = R.brain && R.brain.name();
    if (nm) text = pick(text).replace(/사용자님/g, nm + '님').replace(/\{호칭\}/g, nm + '님');
    else text = pick(text).replace(/\{호칭\}/g, R.T('사용자님', 'you'));
    return say('control', text, o);
  };
  var CA = function (text, o) { o = o || {}; o.to = 'APEX'; return say('control', text, o); };
  var A = function (text, o) { o = o || {}; o.to = 'CONTROL'; return say('apex', text, o); };

  function userLine(text) {
    var s = shell('user', null);
    R.decode(s.body, text, { speed: 8 });
  }

  /* ───────── 보관소 조회 도우미 ───────── */
  var TYPE_WORDS = [
    ['character', /(인물|사람|캐릭터|요원|인간|\bcharacters?\b|\bperson\b|\bpeople\b|\bagent\b)/i], ['organization', /(조직|단체|세력|기관|부대|회사|\borg(anization)?s?\b|\bgroup\b|\bfaction\b)/i],
    ['location', /(장소|지역|위치|건물|도시|기지|\blocations?\b|\bplaces?\b|\barea\b)/i], ['item', /(물품|아이템|물건|장비|무기|도구|\bitems?\b|\bobject\b|\bweapon\b)/i],
    ['planet', /(행성|\bplanets?\b)/i], ['event', /(사건|이벤트|일어난 일|\bevents?\b)/i]
  ];
  function typeOf(t) { for (var i = 0; i < TYPE_WORDS.length; i++) if (TYPE_WORDS[i][1].test(t)) return TYPE_WORDS[i][0]; return null; }
  function clearanceOf(t) {
    if (/(극비|top\s*secret|3급|등급\s*3)/i.test(t)) return 3;
    if (/(기밀|secret|2급|등급\s*2)/i.test(t)) return 2;
    if (/(대외비|restricted|1급|등급\s*1)/i.test(t)) return 1;
    if (/(공개|unclassified|일반|0급|등급\s*0)/i.test(t)) return 0;
    if (/^\s*[0-3]\s*$/.test(t)) return +t.trim();
    return null;
  }
  function byCode(code) {
    var m = String(code).match(/^(chr|org|loc|itm|lor)-?0*(\d{1,4})$/i);
    if (!m) return null;
    return R.A.entities.find(function (e) { return R.type(e.type).code === m[1].toUpperCase() && e.no === +m[2]; }) || null;
  }
  /* 문장 안에 언급된 파일들 (코드 · 이름 · 별칭), 등장 순서대로 */
  function mentions(text) {
    var found = [], taken = [], low = text.toLowerCase();
    var free = function (a, b) { return !taken.some(function (r) { return a < r[1] && b > r[0]; }); };
    var re = /\b(chr|org|loc|itm|lor)-?0*(\d{1,4})\b/gi, m;
    while ((m = re.exec(text))) { var e = byCode(m[1] + '-' + m[2]); if (e) { found.push({ e: e, i: m.index }); taken.push([m.index, m.index + m[0].length]); } }
    var names = [];
    R.A.entities.forEach(function (e) { [e.name, e.alias].forEach(function (n) { if (n && n.length >= 2) names.push({ n: n.toLowerCase(), e: e }); }); });
    names.sort(function (a, b) { return b.n.length - a.n.length; });
    names.forEach(function (x) {
      var i = low.indexOf(x.n);
      while (i >= 0) {
        if (free(i, i + x.n.length)) { if (!found.some(function (f) { return f.e === x.e; })) found.push({ e: x.e, i: i }); taken.push([i, i + x.n.length]); break; }
        i = low.indexOf(x.n, i + 1);
      }
    });
    return found.sort(function (a, b) { return a.i - b.i; }).map(function (f) { return f.e; });
  }

  /* 데이터 블록 */
  function dossierLines(e) {
    var t = R.type(e.type), L2 = [];
    L2.push({ t: R.code(e) + '   ' + t.name + '   [' + R.CLEAR[e.clearance].code + ']', c: 'hi' });
    L2.push({ t: e.name + (e.alias ? '  //  ' + e.alias : ''), c: 'b' });
    if (e.summary) L2.push({ t: e.summary, c: 'mut' });
    if (e.tags.length) L2.push({ t: e.tags.map(function (g) { return '#' + g; }).join(' '), c: 'dim' });
    var facts = (e.status ? [{ k: R.T('상태', 'Status'), v: e.status }] : []).concat(e.fields);
    if (facts.length) { L2.push({ t: '─'.repeat(Math.min(40, cols() - 2)), c: 'rule' }); facts.forEach(function (f) { L2.push({ t: fit(f.k, 12) + f.v }); }); }
    if (e.body) { L2.push({ t: '─'.repeat(Math.min(40, cols() - 2)), c: 'rule' }); e.body.split('\n').forEach(function (ln) { L2.push({ t: ln }); }); }
    var links = R.A.links.filter(function (l) { return l.a === e.id || l.b === e.id; });
    if (links.length) {
      L2.push({ t: 'LINKS', c: 'hi' });
      links.forEach(function (l) {
        var o = R.A.entities.find(function (x) { return x.id === (l.a === e.id ? l.b : l.a); }); if (!o) return;
        L2.push({ t: '  ' + (l.a === e.id ? '→ ' : '← ') + fit(l.label || R.T('관계', 'link'), 10) + R.code(o) + '  ' + o.name });
      });
    }
    var evs = R.A.events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
    if (evs.length) { L2.push({ t: 'EVENTS', c: 'hi' }); evs.forEach(function (v) { L2.push({ t: '  ' + fit(v.date || R.T('날짜 미상', 'undated'), 12) + v.title }); }); }
    return L2;
  }
  function listLines(list) {
    var narrow = cols() < 60, out2 = [];
    list.forEach(function (e) {
      var extra = [e.alias, e.status].filter(Boolean).join(' · ');
      if (narrow) { out2.push({ t: R.code(e) + '  ' + R.CLEAR[e.clearance].code, c: e.clearance >= 2 ? 'hi' : '' }); out2.push({ t: '  ' + e.name + (extra ? '  ' + extra : '') }); }
      else out2.push({ t: R.code(e) + '  ' + fit(R.CLEAR[e.clearance].code, 13) + fit(e.name, 20) + extra });
    });
    out2.push({ t: R.T('총 ' + list.length + '건', list.length + ' total'), c: 'dim' });
    return out2;
  }

  function stripJosa(v) { return v.replace(/^["'“‘]|["'”’]$/g, '').replace(/\s*(이고|이며|이야|입니다|이에요|예요|이요|요)$/, '').trim(); }

  /* ───────── 그 밖의 요청 ───────── */
  function view(e) {
    CA(fmt(Lx().view.toApex, { 코드: R.code(e), 대상: e.name }), { wait: 300 });
    A(fmt(Lx().view.ack, { 코드: R.code(e) }), { pre: dossierLines(e) });
    C(fmt(Lx().view.toUser, { 코드: R.code(e), 이름: e.name }), { wait: 300 });
    R.log('SYS', R.T('문서 열람 ', 'Opened ') + R.code(e));
  }
  function list(type) {
    var items = R.A.entities.filter(function (e) { return !type || e.type === type; }).sort(function (a, b) { return a.type === b.type ? a.no - b.no : R.TYPES.findIndex(function (k) { return k.id === a.type; }) - R.TYPES.findIndex(function (k) { return k.id === b.type; }); });
    var seals = R.SEALED.filter(function (s) { return !type || s.type === type; });
    if (!items.length && !seals.length) return C(R.A.entities.length ? Lx().view.noType : Lx().boot.empty);
    CA(Lx().view.listToApex, { wait: 280 });
    var lines = items.length ? listLines(items) : [];
    seals.forEach(function (s) { lines.splice(Math.max(0, lines.length - (items.length ? 1 : 0)), 0, { t: s.code + '  ' + fit('SEALED', 13) + fit(s.name, 20) + s.status, c: 'dim' }); });
    A(fmt(Lx().view.listAck, { n: items.length + seals.length, s: seals.length }), { pre: lines });
    C(Lx().view.listUser);
  }
  function search(q) {
    if (!q) return C(Lx().view.searchAsk);
    var ql = q.toLowerCase();
    var hits = R.A.entities.filter(function (e) { return [e.name, e.alias, e.summary, e.body, e.status, R.code(e), e.tags.join(' '), e.fields.map(function (f) { return f.k + ' ' + f.v; }).join(' ')].join(' ').toLowerCase().indexOf(ql) >= 0; });
    var evs = R.A.events.filter(function (v) { return (v.title + ' ' + v.desc + ' ' + v.date).toLowerCase().indexOf(ql) >= 0; });
    CA(fmt(Lx().view.searchToApex, { q: q }), { wait: 280 });
    if (!hits.length && !evs.length) { A(fmt(Lx().view.searchHits, { n: 0 })); return C(fmt(Lx().view.searchNone, { q: q })); }
    A(fmt(Lx().view.searchHits, { n: hits.length + evs.length }), { pre: hits.map(function (e) { return { t: R.code(e) + '  ' + e.name + (e.summary ? '  ' + e.summary : '') }; }).concat(evs.map(function (v) { return { t: 'EVENT  ' + (v.date || R.T('날짜 미상', 'undated')) + '  ' + v.title, c: 'mut' }; })) });
    C(fmt(Lx().view.searchUser, { q: q }));
  }
  function events(target) {
    var evs = R.A.events.filter(function (v) { return !target || v.entities.indexOf(target.id) >= 0; }).sort(R.byDate);
    if (!evs.length) return C(Lx().event.none);
    CA(Lx().event.listToApex, { wait: 280 });
    var pre = [];
    evs.forEach(function (v) {
      pre.push({ t: (v.major ? '◆ ' : '◇ ') + fit(v.date || R.T('날짜 미상', 'undated'), 12) + v.title, c: v.major ? 'hi' : '' });
      if (v.desc) pre.push({ t: '              ' + v.desc, c: 'mut' });
    });
    A(fmt(Lx().event.listAck, { n: evs.length }), { pre: pre });
    C(Lx().event.listUser);
  }
  function stat() {
    var d = R.A, pre = [];
    R.TYPES.forEach(function (t) { pre.push({ t: fit(t.code + ' ' + t.name, 14) + d.entities.filter(function (e) { return e.type === t.id; }).length }); });
    R.CLEAR.forEach(function (c) { pre.push({ t: fit(c.code, 14) + d.entities.filter(function (e) { return e.clearance === c.n; }).length, c: 'mut' }); });
    pre.push({ t: fit(R.T('관계', 'Links'), 14) + d.links.length }); pre.push({ t: fit(R.T('사건', 'Events'), 14) + d.events.length }); pre.push({ t: fit(R.T('봉인', 'Sealed'), 14) + R.SEALED.length, c: 'dim' });
    CA(Lx().stat.toApex, { wait: 260 }); A(Lx().stat.ack, { pre: pre }); C(Lx().stat.toUser);
  }
  function help() { C(Lx().smalltalk.help, { pre: Lx().help }); }

  /* 봉인 문서: Apex 가 호출을 시도하지만 미완성 · 승인 없음으로 출력 거부 */
  function sealedReply(s) {
    R.log('WARN', R.T('봉인 문서 열람 요청 ', 'Sealed document request ') + s.code + R.T(' · 승인 없음', ' · not authorized'));
    CA(fmt(Lx().sealed.toApex, { 코드: s.code, 이름: s.name }), { wait: 280 });
    A(fmt(Lx().sealed.ack, { 코드: s.code, 이름: s.name }), { pre: [{ t: s.code + '   ' + s.name, c: 'hi' }, { t: fit(R.T('상태', 'Status'), 12) + R.T('작성 미완료', 'draft incomplete') }, { t: fit(R.T('열람 승인', 'Approval'), 12) + R.T('없음', 'none') }, { t: fit(R.T('출력', 'Output'), 12) + 'ACCESS DENIED', c: 'hi' }] });
    C(fmt(Lx().sealed.toUser, { 코드: s.code, 이름: s.name }));
  }

  function doLock() {
    C(Lx().lock, { wait: 200 });
    chain = chain.then(function () { return new Promise(function (r) { setTimeout(function () { R.lock(); r(); }, 500); }); });
  }
  function setLang(l) {
    R.setLang(l);
    CA(l === 'en' ? 'Apex, switch output to English.' : 'Apex, 출력 언어 한국어로 전환.', { wait: 200 });
    A(Lx().lang.apex);
    C(Lx().lang.set);
    R.log('SYS', R.T('표시 언어: 한국어', 'Display language: English'));
  }

  /* 아카이브는 열람 전용: 작성 · 수정 · 삭제 · 관계 연결 · 사건 기록 요청은 거절 */
  function readOnly() {
    CA(Lx().ro.toApex, { wait: 240 });
    A(Lx().ro.apex);
    C(Lx().ro.user);
  }

  /* CCTV: "CCTV" · "캠" 이면 감시실(격자), 캠 코드(A-001 등)면 그 카메라를 크게. "캠 종료" 로 닫음 */
  function camera(t) {
    if (/(종료|꺼|끄|닫|중지|close|off|stop|end)/i.test(t)) {
      if (!R.cctv.isOpen()) return C(Lx().sim.notOpen);
      R.closeModule(); return C(Lx().sim.closed);
    }
    var p = R.camFind(t);
    var q = (String(t).match(/\b[a-z]\s*-?\s*\d{3}\b/i) || [''])[0].trim();
    if (!p && q) return C(fmt(Lx().sim.unknown, { q: q, 목록: R.CAMS.map(function (c) { return c.code; }).join(' / ') }));
    var live = R.CAMS.filter(function (c) { return !c.off; }).length;
    if (!p) {
      CA(Lx().sim.gridToApex, { wait: 240 });
      A(fmt(Lx().sim.gridAck, { n: R.CAMS.length, l: live, o: R.CAMS.length - live }), { pre: R.CAMS.map(function (c) { return { t: fit(c.code, 8) + fit(c.name, 22) + (c.off ? 'OFFLINE' : 'LIVE'), c: c.off ? 'dim' : '' }; }) });
      C(Lx().sim.grid);
      chain = chain.then(function () { if (R.cctv.isOpen()) R.cctv.focus(null); else R.go('cctv'); });
      return;
    }
    CA(fmt(Lx().sim.toApex, { 코드: p.code }), { wait: 240 });
    if (p.off) { A(fmt(Lx().sim.offAck, { 코드: p.code })); C(fmt(Lx().sim.off, { 코드: p.code, 이름: p.name })); }
    else { A(fmt(Lx().sim.ack, { 코드: p.code })); C(fmt(Lx().sim.user, { 코드: p.code, 이름: p.name })); }
    chain = chain.then(function () { if (R.cctv.isOpen()) R.cctv.focus(p.code); else R.go('cctv', { cam: p.code }); });
  }

  /* ───────── 학습 (Control 이 가르친 말을 기억) ───────── */
  var Q = '["\'“”‘’`]';
  var unq = function (s) { return String(s || '').trim().replace(new RegExp('^' + Q + '+|' + Q + '+$', 'g'), '').trim(); };
  var lastMiss = null, offer = null, fell = false, depth = 0;
  /* 가르치는 말 알아보기 → { say, act } */
  var VAGUE = /^(그건|그거|그게|그\s*말|이건|이거|이게|방금\s*(건|거|말)|아까\s*(건|거|말)|that|it|this)$/i;
  function teachOf(t) {
    var r = teachRaw(t);
    return r && r.say && r.act && !VAGUE.test(r.say) ? r : null;
  }
  function teachRaw(t) {
    var s = t.trim().replace(/^(앞으로(는)?|이제(부터)?|다음부터(는)?)\s*/, ''), m;
    // X 는 Y 라는 뜻이야
    if ((m = s.match(/^(.+?)\s*(?:이?라고\s*하면|은|는|이란|란)\s+(.+?)\s*(?:이?라는|란)\s*뜻(?:이야|이에요|입니다|이다|임|으로\s*알아\s*둬|으로\s*기억해)?\s*[.!]*$/))) return { say: unq(m[1]), act: unq(m[2]) };
    // X 라고 하면 Y (해줘)
    if ((m = s.match(/^(.+?)\s*(?:이?라고|라구)\s*(?:하면|말하면|치면|입력하면|쓰면)\s*,?\s*(.+?)\s*(?:해\s*줘|해줘|해\s*주세요|실행해\s*줘|실행해|처리해\s*줘|처리해|로\s*해\s*줘|으로\s*해\s*줘)?\s*[.!]*$/))) return { say: unq(m[1]), act: unq(m[2]) };
    // X = Y · X -> Y
    if ((m = s.match(/^(.+?)\s*(?:=>|->|=|→)\s*(.+)$/))) return { say: unq(m[1]), act: unq(m[2]) };
    // when I say X, do Y
    if ((m = s.match(/^(?:from\s+now\s+on,?\s*)?(?:when|if)\s+i\s+say\s+(.+?),?\s+(?:do|run|it\s+means|means|mean|open)\s+(.+?)\.?$/i))) return { say: unq(m[1]), act: unq(m[2]) };
    return null;
  }
  /* 학습 관리 명령 (목록 · 지우기 · 초기화 · 내보내기 · 가져오기 · 호칭) → 처리했으면 true */
  function brainCmd(t) {
    var s = t.trim(), m, L = Lx().learn;
    if (/^(학습|기억|배운\s*(것|거|말))\s*(목록|리스트|보여\s*줘?|확인|현황)?\s*[?.!]*$|^(뭘|무엇을|뭐)\s*배웠|^what\s+did\s+you\s+learn|^(learned|learning)(\s+list)?$/i.test(s)) { learnList(); return true; }
    if (/^(학습|learning)\s*(내보내기|내보내|공유|저장|export)/i.test(s)) {
      C(L.exportAsk, { wait: 200 });
      chain = chain.then(function () { return R.brain.exportFile(); }).then(function (n) {
        if (n === 'empty') C(L.none); else if (n) { R.log('SEC', R.T('학습 내보내기 ', 'Learning exported ') + n + R.T('건', '')); C(fmt(L.exported, { n: n })); }
      }, function (e) { C(fmt(Lx().error, { q: e.message })); });
      return true;
    }
    if (/^(학습|learning)\s*(가져오기|가져와|불러오기|불러와|합치기|import)/i.test(s)) {
      C(L.importAsk, { wait: 200 });
      chain = chain.then(function () { return R.brain.importFile(); }).then(function (r) {
        if (r) { R.log('SEC', R.T('학습 가져오기 · 새 규칙 ', 'Learning imported · new ') + r.added + R.T('건 · 바뀐 규칙 ', ' · changed ') + r.changed + R.T('건', '')); CA(fmt(L.mergeToApex, { n: r.added }), { wait: 200 }); A(fmt(L.mergeAck, { n: r.added, c: r.changed })); C(fmt(L.imported, { n: r.added, c: r.changed })); }
      }, function (e) { C(fmt(Lx().error, { q: e.message })); });
      return true;
    }
    if (/^(학습|기억)\s*(초기화|리셋|전부\s*(지워|삭제|잊어))|^forget\s+everything$/i.test(s)) {
      chain = chain.then(function () { return R.ui.confirm(R.T('학습 초기화', 'Reset learning'), R.T('Control 이 배운 말과 호칭을 모두 지웁니다.', 'Control will forget every taught phrase and name.'), R.T('초기화', 'Reset'), true); }).then(function (ok) {
        if (!ok) return C(Lx().cancelled);
        var n = R.brain.wipe(); R.log('SEC', R.T('학습 초기화 · ', 'Learning reset · ') + n + R.T('건 삭제', ' removed')); C(fmt(L.wiped, { n: n }));
      });
      return true;
    }
    if ((m = s.match(/^(?:학습|기억)\s*(?:삭제|지워|지우기|잊어)\s*#?(\d+)\s*[.!]*$/)) || (m = s.match(/^#?(\d+)\s*번?\s*(?:학습|기억)?\s*(?:삭제|지워|잊어)/))) {
      var list = R.brain.get().rules, r = list[+m[1] - 1];
      if (!r) return C(fmt(L.noNum, { n: m[1] })), true;
      R.brain.forget(r); R.log('DATA', R.T('학습 삭제: ', 'Learning removed: ') + r.say); C(fmt(L.forgot, jo({ say: r.say })));
      return true;
    }
    if ((m = s.match(/^["'“‘]?(.+?)["'”’]?\s*(?:은|는|이란|란|을|를)?\s*(?:잊어\s*(?:줘|버려)?|잊어버려|기억에서\s*지워)\s*[.!]*$/)) || (m = s.match(/^forget\s+["']?(.+?)["']?\.?$/i))) {
      var hit = R.brain.get().rules.filter(function (x) { return R.brainKey(x.say) === R.brainKey(m[1]); })[0];
      if (!hit) return C(fmt(L.notKnown, jo({ say: unq(m[1]) }))), true;
      R.brain.forget(hit); R.log('DATA', R.T('학습 삭제: ', 'Learning removed: ') + hit.say); C(fmt(L.forgot, jo({ say: hit.say })));
      return true;
    }
    // 호칭
    if ((m = s.match(/^(?:앞으로\s*)?(?:나를|날|저를|절)\s*["'“‘]?(.+?)["'”’]?\s*(?:이?라고|으로|로)\s*불러\s*(?:줘|주세요|요|줄래)?\s*[.!]*$/)) || (m = s.match(/^(?:내|제)\s*이름은\s*["'“‘]?(.+?)["'”’]?\s*(?:이야|야|입니다|이에요|예요|임)?\s*[.!]*$/)) || (m = s.match(/^call\s+me\s+["']?(.+?)["']?\.?$/i))) {
      var nm = unq(m[1]).replace(/님$/, '').slice(0, 24);
      if (!nm) return false;
      R.brain.setName(nm); R.log('DATA', R.T('호칭 학습: ', 'Name learned: ') + nm); C(fmt(L.named, { name: nm }));
      return true;
    }
    if (/^(호칭|이름)\s*(지워|삭제|초기화|원래대로)|원래대로\s*불러/.test(s)) { R.brain.setName(''); C(L.unnamed); return true; }
    return false;
  }
  function learnList() {
    var L = Lx().learn, mine = R.brain.get().rules, base = R.brain.all().filter(function (r) { return r.src === 'builtin'; });
    CA(L.listToApex, { wait: 200 });
    if (!mine.length && !base.length) { A(L.listEmpty); return C(L.none); }
    var w = Math.min(26, Math.max(8, Math.floor(cols() * 0.38)));
    var rows = mine.map(function (r, i) { return { t: fit('#' + (i + 1), 5) + fit(r.say, w) + ' → ' + r.act + (r.n ? '  ×' + r.n : '') + (r.src === 'import' ? R.T('  (가져옴)', '  (imported)') : '') }; });
    if (base.length) { rows.push({ t: ' ' }); rows.push({ t: R.T('[앱 기본 규칙]', '[BUILT-IN]'), c: 'hi' }); base.forEach(function (r) { rows.push({ t: fit('·', 5) + fit(r.say, w) + ' → ' + r.act }); }); }
    A(fmt(L.listAck, { n: mine.length, b: base.length }), { pre: rows });
    C(L.listUser);
  }
  /* 배운 규칙 실행: Apex 가 규칙을 찾아 원래 명령으로 바꿔 처리 */
  function runRule(r, near) {
    R.brain.used(r);
    A(fmt(near ? Lx().learn.applyNear : Lx().learn.apply, { say: r.say, act: r.act }), { wait: 160 });
    depth++;
    try { handle(r.act); } finally { depth--; }
  }
  function learnFrom(say, act, how) {
    var L = Lx().learn;
    if (!say || !act) return C(L.teachBad);
    if (R.brainKey(say) === R.brainKey(act)) return C(L.teachSame);
    if (teachOf(act)) return C(L.teachBad);
    var res = R.brain.teach(say, act);
    R.log('DATA', R.T('학습: ', 'Learned: ') + '"' + say + '" → "' + act + '"');
    CA(fmt(L.toApex, { say: say, act: act }), { wait: 220 });
    A(fmt(res.updated ? L.ackUpdate : L.ack, { n: R.brain.get().rules.length }));
    C(fmt(how === 'miss' ? L.learnedMiss : L.learned, jo({ say: say, act: act })));
  }

  /* ───────── 입력 해석 ───────── */
  function handle(t) {
    fell = false;
    if (depth > 3) { fell = true; return C(Lx().learn.loop); }
    if (depth === 0) {
      var yes = /^(응|어|네|예|그래|좋아|맞아|ㅇㅇ|ㅇ|yes|y|ok|okay|sure)[.!]*$/i.test(t.trim()), no = /^(아니|아냐|아니요|ㄴㄴ|ㄴ|no|n|nope)[.!]*$/i.test(t.trim());
      // 직전 제안("이 말도 같은 뜻으로 기억할까요?")에 대한 대답
      if (offer && (yes || no)) { var o = offer; offer = null; lastMiss = null; return yes ? learnFrom(o.say, o.act, 'miss') : C(Lx().learn.declined); }
      offer = null;
      // 가르치기 · 학습 관리
      var tc = teachOf(t);
      if (tc && !/^(https?:|www\.)/i.test(t.trim())) { lastMiss = null; return learnFrom(tc.say, tc.act); }
      // 못 알아들은 말 바로 뒤: "Y 라는 뜻이야"
      var mm = lastMiss && t.trim().match(/^(?:그건|그거|그\s*말은|그\s*뜻은|방금\s*건|아까\s*건)?\s*(.+?)\s*(?:이?라는|란)\s*뜻(?:이야|이에요|입니다|이다|임)?\s*[.!]*$/);
      if (mm) { var miss = lastMiss; lastMiss = null; learnFrom(miss, unq(mm[1]), 'miss'); depth++; try { handle(unq(mm[1])); } finally { depth--; } return; }
      if (brainCmd(t)) { lastMiss = null; return; }
      // 가르친 말과 정확히 같으면 그 명령으로
      var ex = R.brain.exact(t);
      if (ex) { lastMiss = null; return runRule(ex); }
      var prevMiss = lastMiss;
      route(t);
      if (fell) {
        // 오타 · 띄어쓰기 차이로 비슷한 배운 말이 있으면 그걸로
        var nr = R.brain.near(t);
        if (nr) { lastMiss = null; C(fmt(Lx().learn.guess, jo({ say: nr.say })), { wait: 120 }); return runRule(nr, true); }
        lastMiss = t.trim();
        C(Lx().learn.askMeaning, { wait: 200 });
      } else if (prevMiss && R.brainKey(prevMiss) !== R.brainKey(t)) {
        // 못 알아들은 말 다음에 다르게 말해서 처리됐으면 → 같은 뜻으로 기억할지 물어봄
        offer = { say: prevMiss, act: t.trim() }; lastMiss = null;
        C(fmt(Lx().learn.offer, jo({ say: offer.say, act: offer.act })), { wait: 300 });
      } else lastMiss = null;
      return;
    }
    // 배운 규칙 안의 명령이 또 다른 배운 말이면 이어서 처리 (서로 부르면 위에서 멈춤)
    var ex2 = R.brain.exact(t);
    if (ex2) return runRule(ex2);
    return route(t);
  }

  function route(t) {
    // ── 명령어 (정확히 이 낱말일 때) ──
    var cmd = t.trim().toLowerCase().replace(/[.!?]+$/, '');
    if (/^(도움말|도움|help|\?|명령어|commands?)$/.test(cmd)) return help();
    if (/^(eng|english|영어)$/.test(cmd)) return setLang('en');
    if (/^(한글|한국어|korean|kor|ko)$/.test(cmd)) return setLang('ko');
    if (/^(msg|메신저|messenger)$/.test(cmd)) { C(Lx().module.msg, { wait: 200 }); chain = chain.then(function () { R.go('msg'); }); return; }
    if (/^(아카이브|archive)(\s*(켜|열어|보여|on|open).*)?$/.test(cmd) || /아카이브\s*(좀\s*)?(켜|열어|보여)|open\s+(the\s+)?archive/i.test(t)) { C(Lx().module.files, { wait: 200 }); chain = chain.then(function () { R.go('files'); }); return; }
    if (/^(잠금|lock|잠가|잠가줘)$/.test(cmd)) return doLock();
    // CCTV: "CCTV" · "캠" · "감시실" 또는 캠 코드(A-001 · 캠 A-001), 닫기: 캠 종료
    if (/^\s*[a-z]\s*-?\s*\d{3}\s*$/i.test(t) || /(^|\s)(캠|카메라|cam|camera|cctv|감시실|감시\s*화면)(\s|$)/i.test(t) || /^(캠|cctv|감시)/i.test(t.trim())) return camera(t);
    // 봉인 문서(I Archi 행성 등)에 대한 요청은 무엇이든 승인 거부
    var seal = R.sealedIn(t);
    if (seal.length) return sealedReply(seal[0]);
    var ms = mentions(t);
    var wantCreate = /(만들|작성|생성|추가|새로|새\s*(문서|파일)|써\s*줘|써줘|등록해|기록해|\b(create|make|write|new|add|record)\b)/i.test(t);
    if (/^(도움|도와|help\b)|뭘\s*할\s*수|무엇을\s*할\s*수|뭐\s*할\s*수|사용법|어떻게\s*(써|사용)|what can you do/i.test(t)) return help();
    if (/^(안녕|하이|hello|hi\b|ㅎㅇ|반가)/i.test(t)) return C(Lx().smalltalk.hello);
    if (/(고마워|고맙|감사|ㄳ|thx|thanks)/i.test(t)) return C(Lx().smalltalk.thanks);
    if (/(apex|에이펙스).*(누구|뭐|무엇|소개|정체)|who\s+is\s+apex|what\s+is\s+apex/i.test(t)) { C(Lx().smalltalk.apex); return A(Lx().smalltalk.apexSelf); }
    if (/(너|control|컨트롤).*(누구|뭐야|정체|소개)|누구(야|세요|니)\??$|who\s+are\s+you/i.test(t)) return C(Lx().smalltalk.who);
    if (/(잠가|잠궈|잠금|잠그|로그아웃|\block\b|log\s*out)/i.test(t)) return doLock();
    if (/백업|backup/i.test(t)) {
      if (/(불러|가져|복원|열어|읽어|restore|import|load)/i.test(t)) { C(Lx().backup.in); chain = chain.then(function () { R.actions.importBackup(); }); return; }
      C(Lx().backup.out); chain = chain.then(function () { R.actions.exportEnc(); }); return;
    }
    if (/(접속\s*코드|코드|암호|비밀번호|패스워드).*(바꿔|변경|수정|교체)|change\s+(the\s+)?(access\s+)?(code|password)/i.test(t)) { C(Lx().backup.code); chain = chain.then(function () { R.actions.changeCode(); }); return; }
    if (/(관계도|그래프|네트워크|관계망|\bgraph\b|network)/i.test(t) && !wantCreate) { C(Lx().module.graph, { wait: 200 }); chain = chain.then(function () { R.go('graph', ms[0] ? { focus: ms[0].id } : {}); }); return; }
    if (/(타임라인|연대기|연표|timeline|chronicle)/i.test(t) && !wantCreate) { C(Lx().module.timeline, { wait: 200 }); chain = chain.then(function () { R.go('timeline', ms[0] ? { entity: ms[0].id } : {}); }); return; }
    if (/(보안\s*(설정|창|메뉴)|설정\s*(창|열어|보여)|^보안$|^security$|security\s+settings|open\s+settings)/i.test(t.trim())) { C(Lx().module.security, { wait: 200 }); chain = chain.then(function () { R.go('security'); }); return; }
    if (/(파일|문서)\s*(창|관리)/i.test(t)) { C(Lx().module.files, { wait: 200 }); chain = chain.then(function () { R.go('files', ms[0] ? { select: ms[0].id } : {}); }); return; }
    // 작성 · 수정 · 삭제 · 관계 연결 · 사건 기록 → 열람 전용 안내
    var wantChange = wantCreate || /(삭제|지워|폐기|없애|연결해|이어\s*줘|이어줘|관계\s*(맺|추가|등록)|바꿔|변경해|수정|고쳐|갱신|편집|\b(delete|remove|destroy|link|connect|edit|update|modify|change)\b)/i.test(t);
    if (wantChange && !/(코드|암호|비밀번호|패스워드|언어|code|password|language)/i.test(t)) return readOnly();
    if (/(사건|이벤트).*(목록|보여|알려|정리|뭐)|\b(list|show)\s+(the\s+)?events\b|^events$/i.test(t.trim())) return events(ms[0] || null);
    if (/(목록|리스트|전체|전부|모두|다\s*보여|\b(list|index|all)\b)/i.test(t)) return list(typeOf(t));
    if (/(검색|찾아|찾기|찾아줘|\b(search|find|look\s+for)\b)/i.test(t)) {
      var q = /\b(search|find|look\s+for)\b/i.test(t) ? t.replace(/^[\s\S]*?\b(search(\s+for)?|find|look\s+for)\s+/i, '') : t.replace(/(을|를)?\s*(검색|찾아|찾기)[\s\S]*$/, '').replace(/^(보관소|기록|아카이브)에서\s*/, '').trim();
      return search(stripJosa(q));
    }
    if (/(현황|통계|몇\s*(개|건)|얼마나|\b(status|stats|statistics|how\s+many)\b)/i.test(t)) return stat();
    if (ms.length) return view(ms[0]);
    if (depth === 0) { fell = true; return C(Lx().fallback); }
    fell = true; C(Lx().fallback); C(Lx().boot.hint, { wait: 200 });
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text) return;
    userLine(text);
    try { handle(text); } catch (e) { console.error(e); C(fmt(Lx().error, { q: e.message })); }
  }

  R.term = {
    init: function () {
      out = $('#termOut'); input = $('#termIn');
      $('#termForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value; if (!v.trim()) return;
        R.sound.stroke('enter');
        input.value = ''; send(v);
      });
      $('#term').addEventListener('mouseup', function () { if (!window.getSelection().toString()) input.focus(); });
    },
    focus: function () { if (input) input.focus(); },
    send: send,
    boot: function () {
      out.innerHTML = ''; session = null; chain = Promise.resolve(); lastMiss = null; offer = null;
      C(Lx().boot.control, { wait: 500 });
      A(fmt(Lx().boot.apex, { n: R.A.entities.length, s: R.SEALED.length }), { wait: 350 });
      if (!R.A.entities.length) C(Lx().boot.empty, { wait: 300 });
      C(Lx().boot.hint, { wait: 200 });
    }
  };

  /* 타자음: 글자가 실제로 입력되거나 지워졌을 때만 (빈 칸에서 지우기 키를 꾹 눌러도 소리 없음) */
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|password|)$/.test(el.type || '')))) return;
    R.sound.stroke(e.data === ' ' ? 'space' : 'key');
  }, true);

  /* ───────── 로그 창 ───────── */
  var logEl, lastDay = '';
  function dayOf(t) { var d = new Date(t); return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()); }
  function logRow(x, fresh) {
    var day = dayOf(x.t);
    if (day !== lastDay) { logEl.appendChild(h('div', { class: 'lg-day' }, day)); lastDay = day; }
    var d = new Date(x.t), m = h('span', { class: 'lg-m' }, x.m);
    logEl.appendChild(h('div', { class: 'lg' + (fresh ? ' new' : '') },
      h('div', { class: 'lg-top' }, h('span', { class: 'lg-l ' + x.l }, x.l), h('span', { class: 'lg-t' }, p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()))),
      m));
    if (fresh) R.decode(m, x.m, { speed: 14 });
  }
  R.logwin = {
    init: function () {
      logEl = $('#logList');
      // 가로 띠: 마우스 휠을 가로 스크롤로
      logEl.addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { logEl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      R.onLog(function (x) {
        if (!logEl || $('#app').hidden) return;
        logRow(x, true);
        while (logEl.children.length > 600) logEl.removeChild(logEl.firstChild);
        logEl.scrollLeft = logEl.scrollWidth;
        $('#logCount').textContent = db().logs.length + ' ENTRIES';
      });
    },
    render: function () {
      logEl.innerHTML = ''; lastDay = '';
      db().logs.forEach(function (x) { logRow(x, false); });
      R.$$('.lg-m', logEl).slice(-30).forEach(function (m, i) { R.decode(m, m.textContent, { delay: i * 30, speed: 14 }); });
      logEl.scrollLeft = logEl.scrollWidth;
      $('#logCount').textContent = db().logs.length + ' ENTRIES';
    }
  };
})();
