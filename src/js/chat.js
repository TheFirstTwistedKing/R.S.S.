/* 메인 화면: 터미널 모양의 대화창 (Control · Apex) + 시스템 로그 창
   명령어 없이 말로 요청한다. 해석은 앱 안의 규칙 기반 처리(인터넷·외부 AI 사용 안 함). */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h, L = window.RSSLines;
  var out, input, chain = Promise.resolve(), session = null;
  var db = function () { return R.store.db; };

  /* ───────── 문구 도우미 ───────── */
  function pick(x) { return Array.isArray(x) ? x[(Math.random() * x.length) | 0] : x; }
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
  var CODE_RE = /\b(CHR|ORG|LOC|ITM|LOR)-\d{4}\b/g;
  function enrich(el, text) {
    el.textContent = '';
    var re = /\|\|([\s\S]+?)\|\||\b(?:CHR|ORG|LOC|ITM|LOR)-\d{4}\b/g, last = 0, m;
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
  var C = function (text, o) { o = o || {}; o.to = o.to || 'USER'; return say('control', text, o); };
  var CA = function (text, o) { o = o || {}; o.to = 'APEX'; return say('control', text, o); };
  var A = function (text, o) { o = o || {}; o.to = 'CONTROL'; return say('apex', text, o); };

  function userLine(text) {
    var s = shell('user', null);
    R.decode(s.body, text, { speed: 8 });
  }

  /* ───────── 보관소 조회 도우미 ───────── */
  var TYPE_WORDS = [
    ['character', /(인물|사람|캐릭터|요원|인간)/], ['organization', /(조직|단체|세력|기관|부대|회사)/],
    ['location', /(장소|지역|위치|건물|도시|기지)/], ['item', /(물품|아이템|물건|장비|무기|도구)/],
    ['lore', /(세계관|설정|역사|규칙|로어|용어)/], ['event', /(사건|이벤트|일어난 일)/]
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
    return db().entities.find(function (e) { return R.type(e.type).code === m[1].toUpperCase() && e.no === +m[2]; }) || null;
  }
  /* 문장 안에 언급된 파일들 (코드 · 이름 · 별칭), 등장 순서대로 */
  function mentions(text) {
    var found = [], taken = [], low = text.toLowerCase();
    var free = function (a, b) { return !taken.some(function (r) { return a < r[1] && b > r[0]; }); };
    var re = /\b(chr|org|loc|itm|lor)-?0*(\d{1,4})\b/gi, m;
    while ((m = re.exec(text))) { var e = byCode(m[1] + '-' + m[2]); if (e) { found.push({ e: e, i: m.index }); taken.push([m.index, m.index + m[0].length]); } }
    var names = [];
    db().entities.forEach(function (e) { [e.name, e.alias].forEach(function (n) { if (n && n.length >= 2) names.push({ n: n.toLowerCase(), e: e }); }); });
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
    var facts = (e.status ? [{ k: '상태', v: e.status }] : []).concat(e.fields);
    if (facts.length) { L2.push({ t: '─'.repeat(Math.min(40, cols() - 2)), c: 'rule' }); facts.forEach(function (f) { L2.push({ t: fit(f.k, 12) + f.v }); }); }
    if (e.body) { L2.push({ t: '─'.repeat(Math.min(40, cols() - 2)), c: 'rule' }); e.body.split('\n').forEach(function (ln) { L2.push({ t: ln }); }); }
    var links = db().links.filter(function (l) { return l.a === e.id || l.b === e.id; });
    if (links.length) {
      L2.push({ t: 'LINKS', c: 'hi' });
      links.forEach(function (l) {
        var o = db().entities.find(function (x) { return x.id === (l.a === e.id ? l.b : l.a); }); if (!o) return;
        L2.push({ t: '  ' + (l.a === e.id ? '→ ' : '← ') + fit(l.label || '관계', 10) + R.code(o) + '  ' + o.name });
      });
    }
    var evs = db().events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
    if (evs.length) { L2.push({ t: 'EVENTS', c: 'hi' }); evs.forEach(function (v) { L2.push({ t: '  ' + fit(v.date || '날짜 미상', 12) + v.title }); }); }
    return L2;
  }
  function listLines(list) {
    var narrow = cols() < 60, out2 = [];
    list.forEach(function (e) {
      var extra = [e.alias, e.status].filter(Boolean).join(' · ');
      if (narrow) { out2.push({ t: R.code(e) + '  ' + R.CLEAR[e.clearance].code, c: e.clearance >= 2 ? 'hi' : '' }); out2.push({ t: '  ' + e.name + (extra ? '  ' + extra : '') }); }
      else out2.push({ t: R.code(e) + '  ' + fit(R.CLEAR[e.clearance].code, 13) + fit(e.name, 20) + extra });
    });
    out2.push({ t: '총 ' + list.length + '건', c: 'dim' });
    return out2;
  }

  /* ───────── 문서 템플릿 (Apex 가 누락 항목을 판단하는 기준) ───────── */
  var TPL = {
    character: [{ k: 'name', q: '이름', req: 1 }, { k: 'clearance', q: '보안 등급', req: 1 }, { k: 'alias', q: '별칭 또는 코드네임' }, { k: 'status', q: '현재 상태' }, { k: 'f:소속', q: '소속' }, { k: 'f:나이', q: '나이' }, { k: 'summary', q: '한 줄 요약' }],
    organization: [{ k: 'name', q: '조직명', req: 1 }, { k: 'clearance', q: '보안 등급', req: 1 }, { k: 'alias', q: '별칭' }, { k: 'status', q: '현재 상태' }, { k: 'f:본거지', q: '본거지' }, { k: 'f:규모', q: '규모' }, { k: 'summary', q: '한 줄 요약' }],
    location: [{ k: 'name', q: '장소명', req: 1 }, { k: 'clearance', q: '보안 등급', req: 1 }, { k: 'f:위치', q: '위치' }, { k: 'f:관할', q: '관할' }, { k: 'summary', q: '한 줄 요약' }],
    item: [{ k: 'name', q: '물품명', req: 1 }, { k: 'clearance', q: '보안 등급', req: 1 }, { k: 'f:분류', q: '분류' }, { k: 'f:소유자', q: '소유자' }, { k: 'summary', q: '한 줄 요약' }],
    lore: [{ k: 'name', q: '항목명', req: 1 }, { k: 'clearance', q: '보안 등급', req: 1 }, { k: 'summary', q: '한 줄 요약' }, { k: 'body', q: '상세 내용' }],
    event: [{ k: 'title', q: '사건명', req: 1 }, { k: 'date', q: '날짜' }, { k: 'desc', q: '개요' }, { k: 'entities', q: '관련 파일' }, { k: 'major', q: '주요 사건 여부' }]
  };
  var TYPE_LABEL = { character: '인물', organization: '조직', location: '장소', item: '물품', lore: '세계관', event: '사건' };
  var LABEL_ALIAS = { '이름': 'name', '명칭': 'name', '별칭': 'alias', '코드네임': 'alias', '코드 네임': 'alias', '등급': 'clearance', '보안 등급': 'clearance', '보안등급': 'clearance', '상태': 'status', '요약': 'summary', '설명': 'summary', '기록': 'body', '내용': 'body', '상세': 'body', '날짜': 'date', '일자': 'date', '사건명': 'title', '제목': 'title', '개요': 'desc' };

  function stripJosa(v) { return v.replace(/^["'“‘]|["'”’]$/g, '').replace(/\s*(이고|이며|이야|입니다|이에요|예요|이요|요)$/, '').trim(); }
  /* 문장 속 "항목 값" 쌍 뽑기 (예: "이름은 한서윤이고 나이 31, 소속은 북부") */
  function extract(text, type) {
    var d = {}, fields = TPL[type] || [];
    var labels = Object.keys(LABEL_ALIAS).concat(fields.filter(function (f) { return f.k.indexOf('f:') === 0; }).map(function (f) { return f.k.slice(2); }));
    labels.sort(function (a, b) { return b.length - a.length; });
    labels.forEach(function (lb) {
      var re = new RegExp(lb + '\\s*(?:은|는|이|가|:|=)?\\s*([^,，.\\n]+?)\\s*(?=(?:,|，|\\.|\\n|이고\\s|이며\\s|이고$|이며$|$|그리고|\\s(?:' + labels.join('|') + ')))');
      var m = text.match(re);
      if (!m) return;
      var key = LABEL_ALIAS[lb] || ('f:' + lb);
      var v = m[1].replace(/\s*(인|으로|로)?\s*(문서|파일|기록)?\s*(만들|작성|생성|등록|추가)[\s\S]*$/, '');
      // "KESTREL인 인물 문서" 처럼 값 뒤에 붙은 유형 설명 제거
      var cut = v.replace(/(인|이라는|라는)?\s*(인물|조직|장소|물품|세계관|사건|사람|캐릭터|문서|파일)(\s[\s\S]*)?$/, '');
      v = stripJosa(cut.trim() ? cut : v);
      // 이름·별칭 뒤에 "인 극비 ..." 처럼 다른 설명이 이어지면 앞 낱말만 사용
      if ((key === 'name' || key === 'alias') && /^(\S+?)인\s+\S/.test(v)) v = v.match(/^(\S+?)인\s/)[1];
      if (key === 'clearance') { var c = clearanceOf(v); if (c != null) d.clearance = c; return; }
      if (v && d[key] == null) d[key] = v;
    });
    if (d.name == null && d.title == null) {
      var q = text.match(/["“'‘]([^"”'’]+)["”'’]/) || text.match(/(\S+?)(?:이라는|라는)\s/);
      if (q) d[type === 'event' ? 'title' : 'name'] = q[1].trim();
    }
    if (d.clearance == null) { var c2 = clearanceOf(text.replace(/보안\s*등급/g, '')); if (c2 != null && /(극비|기밀|대외비|공개)/.test(text)) d.clearance = c2; }
    return d;
  }

  /* ───────── 문서 작성 흐름 (Control → Apex → 누락 요청 → Control → 사용자) ───────── */
  function startDoc(type, pre) {
    var label = TYPE_LABEL[type];
    C(fmt(L.create.toUser, { 유형: label }));
    CA(fmt(type === 'event' ? L.event.toApex : L.create.toApex, { 유형: label }));
    A(fmt(type === 'event' ? L.event.ack : L.create.ack, { 유형: label }));
    var data = pre || {};
    var missing = TPL[type].filter(function (f) { return data[f.k] == null; });
    session = { kind: 'doc', type: type, data: data, queue: missing.slice(), cur: null };
    if (!missing.length) return finishDoc();
    A(fmt(L.create.missing, { n: missing.length, 목록: missing.map(function (f) { return f.q; }).join(', ') }));
    C(fmt(L.create.relay, { 목록: missing.map(function (f) { return f.q; }).join(', ') }));
    askNext(true);
  }
  function hintFor(f) {
    if (f.k === 'clearance') return ' (공개 · 대외비 · 기밀 · 극비)';
    if (f.k === 'major') return ' (예 / 아니오)';
    if (f.k === 'entities') return ' (이름이나 코드, 여러 개면 쉼표로)';
    if (f.k === 'date') return ' (예: 2024-03-14)';
    return f.req ? '' : ' ' + L.create.askOptionalNote;
  }
  function askNext(first) {
    var f = session.queue[0];
    session.cur = f;
    C(fmt(first ? L.create.askFirst : L.create.ask, { 항목: f.q }) + hintFor(f));
  }
  function setField(d, f, v) {
    if (f.k === 'clearance') { var c = clearanceOf(v); if (c == null) return false; d.clearance = c; return true; }
    if (f.k === 'major') { d.major = /^(예|네|응|어|맞아|yes|y|주요)/i.test(v.trim()); return true; }
    if (f.k === 'entities') { d.entities = mentions(v).map(function (e) { return e.id; }); return true; }
    d[f.k] = v; return true;
  }
  function docInput(t) {
    var s = session, f = s.cur;
    if (/^(여기까지|그만\s*물어|나머지\s*(는\s*)?(생략|없음|패스|스킵)|이걸로\s*(됐|충분|끝)|완료|끝)$/.test(t.trim())) {
      var reqLeft = s.queue.filter(function (x) { return x.req; });
      if (reqLeft.length) { C(fmt(L.create.badRequired, { 항목: reqLeft[0].q })); session.cur = reqLeft[0]; s.queue = [reqLeft[0]].concat(s.queue.filter(function (x) { return x !== reqLeft[0]; })); return; }
      return finishDoc();
    }
    if (/^(없음|없어|없어요|없습니다|모름|몰라|모르겠어|패스|스킵|건너뛰기|건너뛰어|넘어가|-|x)$/i.test(t.trim())) {
      if (f.req) { C(fmt(L.create.badRequired, { 항목: f.q })); return; }
      A(fmt(L.create.skip, { 항목: f.q }), { wait: 220 });
      s.queue.shift();
      return s.queue.length ? askNext(false) : finishDoc();
    }
    // 한 번에 여러 항목을 말한 경우도 반영
    var extra = extract(t, s.type), filled = [];
    s.queue.slice(1).forEach(function (x) { if (extra[x.k] != null) { s.data[x.k] = extra[x.k]; filled.push(x); } });
    var val = extra[f.k] != null ? String(extra[f.k]) : stripJosa(t);
    if (f.k === 'clearance' && extra.clearance != null) val = String(extra.clearance);
    if (!setField(s.data, f, val)) { C(L.create.badClearance); return; }
    filled.unshift(f);
    A(filled.map(function (x) { return fmt(L.create.fill, { 항목: x.q }); }).join(' '), { wait: 240 });
    s.queue = s.queue.filter(function (x) { return filled.indexOf(x) < 0; });
    return s.queue.length ? askNext(false) : finishDoc();
  }
  function finishDoc() {
    var s = session; session = null;
    var d = s.data;
    if (s.type === 'event') {
      var ev = { id: R.uid(), date: d.date || '', title: d.title || '제목 없음', desc: d.desc || '', major: !!d.major, entities: d.entities || [] };
      db().events.push(ev);
      R.log('DATA', '사건 기록 ' + (ev.date ? ev.date + ' ' : '') + ev.title);
      R.store.save();
      A('사건 기록 완료. 연대기에 등재. 보고합니다.', { pre: [{ t: (ev.date || '날짜 미상') + '  ' + ev.title, c: 'hi' }, ev.desc ? { t: ev.desc, c: 'mut' } : null].filter(Boolean) });
      C('사건 "' + ev.title + '" 을(를) 기록했습니다. 타임라인에서도 확인하실 수 있습니다.');
      return;
    }
    var e = {
      id: R.uid(), no: ++db().seq, type: s.type, name: d.name || '이름 없음', alias: d.alias || '', clearance: d.clearance != null ? d.clearance : 1,
      status: d.status || '', summary: d.summary || '', body: d.body || '', tags: [], image: '', created: Date.now(), updated: Date.now(),
      fields: Object.keys(d).filter(function (k) { return k.indexOf('f:') === 0 && d[k]; }).map(function (k) { return { k: k.slice(2), v: d[k] }; })
    };
    db().entities.push(e);
    R.log('DATA', '파일 등록 ' + R.code(e) + ' ' + e.name + ' (Apex)');
    R.store.save(); R.fx.radarData();
    A(fmt(L.create.done, { 코드: R.code(e) }), { pre: dossierLines(e) });
    C(fmt(L.create.report, { 코드: R.code(e), 이름: e.name }));
  }

  /* ───────── 그 밖의 요청 ───────── */
  function view(e) {
    CA(fmt(L.view.toApex, { 코드: R.code(e), 대상: e.name }), { wait: 300 });
    A(fmt(L.view.ack, { 코드: R.code(e) }), { pre: dossierLines(e) });
    C(fmt(L.view.toUser, { 코드: R.code(e), 이름: e.name }), { wait: 300 });
    R.log('SYS', '파일 열람 ' + R.code(e));
  }
  function list(type) {
    var items = db().entities.filter(function (e) { return !type || e.type === type; }).sort(function (a, b) { return a.type === b.type ? a.no - b.no : R.TYPES.findIndex(function (k) { return k.id === a.type; }) - R.TYPES.findIndex(function (k) { return k.id === b.type; }); });
    if (!items.length) return C(db().entities.length ? '해당 유형의 파일이 없습니다.' : L.boot.empty);
    CA(L.view.listToApex, { wait: 280 });
    A('목록 ' + items.length + '건 출력.', { pre: listLines(items) });
    C(L.view.listUser);
  }
  function search(q) {
    if (!q) return C('무엇을 찾을까요?');
    var ql = q.toLowerCase();
    var hits = db().entities.filter(function (e) { return [e.name, e.alias, e.summary, e.body, e.status, R.code(e), e.tags.join(' '), e.fields.map(function (f) { return f.k + ' ' + f.v; }).join(' ')].join(' ').toLowerCase().indexOf(ql) >= 0; });
    var evs = db().events.filter(function (v) { return (v.title + ' ' + v.desc + ' ' + v.date).toLowerCase().indexOf(ql) >= 0; });
    CA(fmt(L.view.searchToApex, { q: q }), { wait: 280 });
    if (!hits.length && !evs.length) { A('일치 항목 0건.'); return C(fmt(L.view.searchNone, { q: q })); }
    A('일치 항목 ' + (hits.length + evs.length) + '건.', { pre: hits.map(function (e) { return { t: R.code(e) + '  ' + e.name + (e.summary ? '  ' + e.summary : '') }; }).concat(evs.map(function (v) { return { t: 'EVENT  ' + (v.date || '날짜 미상') + '  ' + v.title, c: 'mut' }; })) });
    C(fmt(L.view.searchUser, { q: q }));
  }
  function events(target) {
    var evs = db().events.filter(function (v) { return !target || v.entities.indexOf(target.id) >= 0; }).sort(R.byDate);
    if (!evs.length) return C(L.event.none);
    CA(L.event.listToApex, { wait: 280 });
    var pre = [];
    evs.forEach(function (v) {
      pre.push({ t: (v.major ? '◆ ' : '◇ ') + fit(v.date || '날짜 미상', 12) + v.title, c: v.major ? 'hi' : '' });
      if (v.desc) pre.push({ t: '              ' + v.desc, c: 'mut' });
    });
    A('사건 ' + evs.length + '건.', { pre: pre });
    C(L.event.listUser);
  }
  function stat() {
    var d = db(), pre = [];
    R.TYPES.forEach(function (t) { pre.push({ t: fit(t.code + ' ' + t.name, 14) + d.entities.filter(function (e) { return e.type === t.id; }).length }); });
    R.CLEAR.forEach(function (c) { pre.push({ t: fit(c.code, 14) + d.entities.filter(function (e) { return e.clearance === c.n; }).length, c: 'mut' }); });
    pre.push({ t: fit('관계', 14) + d.links.length }); pre.push({ t: fit('사건', 14) + d.events.length });
    CA(L.stat.toApex, { wait: 260 }); A('현황 집계 완료.', { pre: pre }); C(L.stat.toUser);
  }
  var EDIT_LABELS = ['보안 등급', '보안등급', '코드네임', '코드 네임', '이름', '별칭', '등급', '상태', '요약', '설명', '기록', '내용'];
  function edit(e, t) {
    var labels = EDIT_LABELS.concat(e.fields.map(function (f) { return f.k; })).concat(Object.keys(TPL).reduce(function (a, k) { return a.concat(TPL[k].filter(function (f) { return f.k.indexOf('f:') === 0; }).map(function (f) { return f.k.slice(2); })); }, []));
    labels.sort(function (a, b) { return b.length - a.length; });
    var lb = null, val = null;
    for (var i = 0; i < labels.length; i++) {
      var re = new RegExp(labels[i] + '\\s*(?:을|를|은|는|이|가)?\\s*(.+?)\\s*(?:으로|로)\\s*(?:바꿔|변경|수정|고쳐|갱신|해|설정|등록)');
      var m = t.match(re); if (m) { lb = labels[i]; val = m[1]; break; }
    }
    if (!lb) { var g = t.match(/\s(\S+?)(?:을|를|은|는)\s+(.+?)\s*(?:으로|로)\s*(?:바꿔|변경|수정|고쳐|갱신|해|설정)/); if (g) { lb = g[1]; val = g[2]; } }
    if (!lb) return C('어느 항목을 무엇으로 바꿀지 알려 주십시오. 예: "' + e.name + ' 상태를 사망으로 바꿔줘"');
    val = stripJosa(val);
    var key = LABEL_ALIAS[lb], before;
    if (key === 'clearance') { var c = clearanceOf(val); if (c == null) return C(L.create.badClearance); before = R.CLEAR[e.clearance].code; e.clearance = c; val = R.CLEAR[c].code; }
    else if (key === 'name' || key === 'alias' || key === 'status' || key === 'summary' || key === 'body') { before = e[key] || '(공란)'; e[key] = val; }
    else { var f = e.fields.find(function (x) { return x.k === lb; }); before = f ? f.v : '(신규)'; if (f) f.v = val; else e.fields.push({ k: lb, v: val }); }
    e.updated = Date.now();
    R.log('DATA', '파일 수정 ' + R.code(e) + ' · ' + lb + ' (Apex)'); R.store.save(); R.fx.radarData();
    CA(fmt(L.edit.toApex, { 코드: R.code(e), 항목: lb, 값: val }), { wait: 280 });
    A(fmt(L.edit.ack, { 코드: R.code(e), 항목: lb, 이전: before, 값: val }));
    C(fmt(L.edit.toUser, { 코드: R.code(e), 이름: e.name, 항목: lb }));
  }
  function link(ms, t) {
    if (ms.length < 2) return C(L.link.need);
    var a = ms[0], b = ms[1];
    var m = t.match(/(\S+?)\s*(?:관계로|으로|로)\s*(?:연결|이어|묶어|등록)/) || t.match(/관계(?:는|은|:)?\s*(\S+)/);
    var label = m ? stripJosa(m[1]) : '';
    if (label && mentions(label).length) label = '';
    db().links.push({ id: R.uid(), a: a.id, b: b.id, label: label });
    R.log('DATA', '관계 연결 ' + R.code(a) + ' → ' + R.code(b) + (label ? ' [' + label + ']' : '') + ' (Apex)'); R.store.save(); R.fx.radarData();
    CA(fmt(L.link.toApex, { A: R.code(a), B: R.code(b), 관계: label || '관계' }), { wait: 280 });
    A(fmt(L.link.ack, { A: R.code(a), B: R.code(b), 관계: label || '관계' }));
    C(fmt(L.link.toUser, { A이름: a.name, B이름: b.name }));
  }
  function askDelete(e) {
    session = { kind: 'confirm', e: e };
    C(fmt(L.del.confirm, { 코드: R.code(e), 이름: e.name }));
  }
  function doDelete(e) {
    var d = db(), n = d.links.filter(function (l) { return l.a === e.id || l.b === e.id; }).length;
    d.entities = d.entities.filter(function (x) { return x.id !== e.id; });
    d.links = d.links.filter(function (l) { return l.a !== e.id && l.b !== e.id; });
    d.events.forEach(function (v) { v.entities = v.entities.filter(function (id) { return id !== e.id; }); });
    R.log('DATA', '파일 삭제 ' + R.code(e) + ' ' + e.name + ' (Apex)'); R.store.save(); R.fx.radarData();
    CA(fmt(L.del.toApex, { 코드: R.code(e) }), { wait: 260 });
    A(fmt(L.del.ack, { 코드: R.code(e), n: n }));
    C(L.del.toUser);
  }
  function help() {
    C(L.smalltalk.help, {
      pre: [
        { t: '문서 작성   "인물 문서 만들어줘" · "이름은 한서윤인 극비 인물 만들어줘"', c: '' },
        { t: '사건 기록   "사건 기록해줘"' },
        { t: '열람        "한서윤 보여줘" · "CHR-0001 열어줘"' },
        { t: '목록·검색   "목록 보여줘" · "인물 목록" · "항만 검색해줘"' },
        { t: '수정        "한서윤 상태를 사망으로 바꿔줘"' },
        { t: '관계        "한서윤과 북부 지부를 소속으로 연결해줘"' },
        { t: '삭제        "항만 7번 창고 삭제해줘"' },
        { t: '사건·현황   "사건 목록" · "현황 알려줘"' },
        { t: '창 열기     "관계도 열어줘" · "타임라인" · "파일 창" · "보안 설정"' },
        { t: '보안        "백업해줘" · "백업 불러와줘" · "코드 바꿔줘" · "잠가줘"' },
        { t: '작성 중     "없음"(건너뛰기) · "여기까지"(마무리) · "취소"', c: 'dim' }
      ]
    });
  }

  /* ───────── 입력 해석 ───────── */
  function handle(t) {
    if (session) {
      if (/^(취소|그만|중단|멈춰|cancel)/i.test(t.trim())) {
        var was = session; session = null;
        if (was.kind === 'doc') { CA('작업 중단.', { wait: 200 }); A(L.create.cancelApex); C(L.create.cancel); }
        else C('취소했습니다.');
        return;
      }
      if (session.kind === 'confirm') {
        var e = session.e; session = null;
        if (/^(응|네|예|어|그래|진행|삭제|ㅇ|ok|yes|y)/i.test(t.trim())) return doDelete(e);
        return C(L.del.cancel);
      }
      if (session.kind === 'pickType') {
        var ty = typeOf(t); session = null;
        if (!ty) { session = { kind: 'pickType', pre: {} }; return C(L.create.askType); }
        return startDoc(ty, extract(t, ty));
      }
      if (session.kind === 'doc') return docInput(t);
    }
    var ms = mentions(t);
    var wantCreate = /(만들|작성|생성|추가|새로|새\s*(문서|파일)|써\s*줘|써줘|등록해|기록해)/.test(t);
    if (/^(도움|도와|help|\?)|뭘\s*할\s*수|무엇을\s*할\s*수|뭐\s*할\s*수|사용법|어떻게\s*(써|사용)/i.test(t)) return help();
    if (/^(안녕|하이|hello|hi\b|ㅎㅇ|반가)/i.test(t)) return C(L.smalltalk.hello);
    if (/(고마워|고맙|감사|ㄳ|thx|thanks)/i.test(t)) return C(L.smalltalk.thanks);
    if (/(apex|에이펙스).*(누구|뭐|무엇|소개|정체)/i.test(t)) { C(L.smalltalk.apex); return A(L.smalltalk.apexSelf); }
    if (/(너|control|컨트롤).*(누구|뭐야|정체|소개)|누구(야|세요|니)\??$/i.test(t)) return C(L.smalltalk.who);
    if (/(잠가|잠궈|잠금|잠그|로그아웃|lock)/i.test(t)) { C(L.lock, { wait: 200 }); chain = chain.then(function () { return new Promise(function (r) { setTimeout(function () { R.lock(); r(); }, 500); }); }); return; }
    if (/백업/.test(t)) {
      if (/(불러|가져|복원|열어|읽어)/.test(t)) { C(L.backup.in); chain = chain.then(function () { R.actions.importBackup(); }); return; }
      C(L.backup.out); chain = chain.then(function () { R.actions.exportEnc(); }); return;
    }
    if (/(접속\s*코드|코드|암호|비밀번호|패스워드).*(바꿔|변경|수정|교체)/.test(t)) { C(L.backup.code); chain = chain.then(function () { R.actions.changeCode(); }); return; }
    if (/(예시|샘플|sample)/i.test(t)) { CA(L.sample.toApex, { wait: 220 }); chain = chain.then(function () { R.sample(); R.fx.radarData(); }); A(L.sample.ack); return C(L.sample.toUser); }
    if (/(관계도|그래프|네트워크|관계망)/.test(t) && !wantCreate) { C(L.module.graph, { wait: 200 }); chain = chain.then(function () { R.go('graph', ms[0] ? { focus: ms[0].id } : {}); }); return; }
    if (/(타임라인|연대기|연표)/.test(t) && !wantCreate) { C(L.module.timeline, { wait: 200 }); chain = chain.then(function () { R.go('timeline', ms[0] ? { entity: ms[0].id } : {}); }); return; }
    if (/(보안\s*(설정|창|메뉴)|설정\s*(창|열어|보여))/.test(t)) { C(L.module.security, { wait: 200 }); chain = chain.then(function () { R.go('security'); }); return; }
    if (/(파일|문서)\s*(창|관리)/.test(t)) { C(L.module.files, { wait: 200 }); chain = chain.then(function () { R.go('files', ms[0] ? { select: ms[0].id } : {}); }); return; }
    if (/(삭제|지워|폐기|없애)/.test(t)) { if (!ms.length) return C('삭제할 파일 이름이나 코드를 알려 주십시오.'); return askDelete(ms[0]); }
    if (/(연결|이어\s*줘|이어줘|관계\s*(맺|추가|등록))/.test(t)) return link(ms, t);
    if (ms.length && /(바꿔|변경|수정|고쳐|갱신|으로\s*해|로\s*해|설정해)/.test(t)) return edit(ms[0], t);
    if (wantCreate) {
      var ty2 = typeOf(t);
      if (!ty2) { CA('Apex, 신규 문서 작성 준비.', { wait: 220 }); A(L.create.apexAskType); session = { kind: 'pickType' }; return C(L.create.askType); }
      return startDoc(ty2, extract(t, ty2));
    }
    if (/(사건|이벤트).*(목록|보여|알려|정리|뭐)/.test(t)) return events(ms[0] || null);
    if (/(목록|리스트|전체|전부|모두|다\s*보여)/.test(t)) return list(typeOf(t));
    if (/(검색|찾아|찾기|찾아줘)/.test(t)) {
      var q = t.replace(/(을|를)?\s*(검색|찾아|찾기)[\s\S]*$/, '').replace(/^(보관소|기록)에서\s*/, '').trim();
      return search(stripJosa(q));
    }
    if (/(현황|통계|몇\s*(개|건)|얼마나)/.test(t)) return stat();
    if (ms.length) return view(ms[0]);
    C(L.fallback); C(L.boot.hint, { wait: 200 });
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text) return;
    userLine(text);
    try { handle(text); } catch (e) { console.error(e); C('처리 중 오류가 발생했습니다: ' + e.message); }
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
      out.innerHTML = ''; session = null; chain = Promise.resolve();
      C(L.boot.control, { wait: 500 });
      A(fmt(L.boot.apex, { n: db().entities.length }), { wait: 350 });
      if (!db().entities.length) C(L.boot.empty, { wait: 300 });
      C(L.boot.hint, { wait: 200 });
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
    if (day !== lastDay) { logEl.appendChild(h('div', { class: 'lg-day' }, '── ' + day + ' ──')); lastDay = day; }
    var d = new Date(x.t), m = h('span', { class: 'lg-m' }, x.m);
    logEl.appendChild(h('div', { class: 'lg' + (fresh ? ' new' : '') },
      h('span', { class: 'lg-t' }, p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())),
      h('span', { class: 'lg-l ' + x.l }, x.l), m));
    if (fresh) R.decode(m, x.m, { speed: 14 });
  }
  R.logwin = {
    init: function () {
      logEl = $('#logList');
      R.onLog(function (x) {
        if (!logEl || $('#app').hidden) return;
        logRow(x, true);
        while (logEl.children.length > 600) logEl.removeChild(logEl.firstChild);
        logEl.scrollTop = logEl.scrollHeight;
        $('#logCount').textContent = db().logs.length + ' ENTRIES';
      });
    },
    render: function () {
      logEl.innerHTML = ''; lastDay = '';
      db().logs.forEach(function (x) { logRow(x, false); });
      R.$$('.lg-m', logEl).slice(-30).forEach(function (m, i) { R.decode(m, m.textContent, { delay: i * 30, speed: 14 }); });
      logEl.scrollTop = logEl.scrollHeight;
      $('#logCount').textContent = db().logs.length + ' ENTRIES';
    }
  };
})();
