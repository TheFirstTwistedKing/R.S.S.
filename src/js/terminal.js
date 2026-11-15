/* 메인 화면: 터미널 창 + 시스템 로그 창 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var out, input, form, hist = [], hi = -1, pending = null, nextAt = 0;
  var db = function () { return R.store.db; };

  /* ── 폭 계산(한글은 2칸) ── */
  function cw(ch) { var c = ch.codePointAt(0); return (c >= 0x1100 && c <= 0x115F) || (c >= 0x2E80 && c <= 0xA4CF) || (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xFF00 && c <= 0xFF60) ? 2 : 1; }
  function sw(s) { var n = 0; for (var ch of String(s)) n += cw(ch); return n; }
  function fit(s, n) {
    s = String(s == null ? '' : s); var o = '', w = 0;
    for (var ch of s) { var k = cw(ch); if (w + k > n) { if (n > 1) { while (sw(o) > n - 1) o = Array.from(o).slice(0, -1).join(''); o += '…'; w = sw(o); } break; } o += ch; w += k; }
    return o + ' '.repeat(Math.max(0, n - sw(o)));
  }

  /* ── 출력: 줄마다 왼쪽→오른쪽으로 새겨지듯 나타남 ── */
  function seg(t, cls, on) { return { t: t, c: cls, on: on }; }
  function line(parts, cls) {
    var el = h('div', { class: 'tr ' + (cls || '') });
    (Array.isArray(parts) ? parts : [parts]).forEach(function (p) {
      if (p == null) return;
      if (typeof p === 'string') el.appendChild(document.createTextNode(p));
      else if (p.nodeType) el.appendChild(p);
      else {
        var s = h('span', { class: p.c || '' }, p.t);
        if (p.on) s.addEventListener('click', p.on);
        el.appendChild(s);
      }
    });
    var now = performance.now();
    var delay = Math.max(0, nextAt - now);
    nextAt = now + delay + 16;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.animation = 'type .22s steps(18) ' + delay + 'ms both';
      if (delay < 600) setTimeout(function () { R.sound.out(); }, delay);
    }
    out.appendChild(el);
    while (out.children.length > 1500) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    setTimeout(function () { out.scrollTop = out.scrollHeight; }, delay + 30);
    return el;
  }
  var css = document.createElement('style');
  css.textContent = '@keyframes type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}';
  document.head.appendChild(css);
  function blank() { line(' '); }
  /* 터미널 폭(글자 칸 수): 좁은 창(모바일)에서는 표를 2줄 형식으로 */
  var cellW = 0;
  function cols() {
    if (!cellW) { var m = h('span', { style: { visibility: 'hidden', position: 'absolute' } }, 'MMMMMMMMMM'); out.appendChild(m); cellW = m.getBoundingClientRect().width / 10 || 8; m.remove(); }
    return Math.max(24, Math.floor((out.clientWidth - 32) / cellW));
  }
  function rule(ch) { line((ch || '─').repeat(Math.min(54, cols())), 'rule'); }
  function ok(m) { line([seg('[ OK ] ', 't-ok'), m]); }
  function err(m) { line('✕ ' + m, 'err'); R.sound.err(); }
  function link(text, cmd) { return seg(text, 't-link', function () { run(cmd, true); }); }
  function clr(e) { return seg(' ' + R.CLEAR[e.clearance].code + ' ', 't-clr c' + e.clearance); }

  /* ── 대상 찾기: 코드(CHR-0001, chr-1) · 이름 · 별칭 ── */
  function resolve(q) {
    if (!q) return { err: '대상을 지정하십시오. 예: cat CHR-0001' };
    var s = q.trim().toLowerCase(), ents = db().entities;
    var m = s.match(/^([a-z]{3})-?0*(\d+)$/);
    if (m) {
      var hit = ents.find(function (e) { return R.type(e.type).code.toLowerCase() === m[1] && e.no === +m[2]; });
      if (hit) return { e: hit };
    }
    var exact = ents.filter(function (e) { return e.name.toLowerCase() === s || e.alias.toLowerCase() === s; });
    if (exact.length === 1) return { e: exact[0] };
    var part = ents.filter(function (e) { return (e.name + ' ' + e.alias).toLowerCase().indexOf(s) >= 0; });
    if (part.length === 1) return { e: part[0] };
    if (!part.length) return { err: '"' + q + '" 에 해당하는 파일이 없습니다.' };
    return { many: part };
  }
  function withTarget(q, fn) {
    var r = resolve(q);
    if (r.e) return fn(r.e);
    if (r.err) return err(r.err);
    line('후보가 여러 개입니다. 코드를 지정하십시오:', 'warn');
    r.many.slice(0, 12).forEach(function (e) { line(['  ', link(R.code(e), 'cat ' + R.code(e)), '  ', e.name]); });
  }
  var TYPEMAP = { chr: 'character', '인물': 'character', org: 'organization', '조직': 'organization', loc: 'location', '장소': 'location', itm: 'item', '물품': 'item', lor: 'lore', '세계관': 'lore' };

  /* ── 명령어 ── */
  var C = {}, ORDER = [];
  function def(names, group, usage, desc, run) {
    var c = { names: names, group: group, usage: usage, desc: desc, run: run };
    names.forEach(function (n) { C[n] = c; }); ORDER.push(c);
  }

  def(['help', '도움말', '?'], '시스템', 'help [명령]', '명령어 목록 / 상세 설명', function (a) {
    if (a[0] && C[a[0]]) { var c = C[a[0]]; line([seg(c.usage, 't-hi')]); line('  ' + c.desc, 'mut'); line('  별칭: ' + c.names.join(', '), 'dim'); return; }
    line('R.S.S. 명령어 목록', 'h1'); rule();
    var groups = {};
    ORDER.forEach(function (c) { (groups[c.group] = groups[c.group] || []).push(c); });
    Object.keys(groups).forEach(function (g) {
      line('[' + g + ']', 'ok');
      groups[g].forEach(function (c) { if (cols() < 60) { line(['  ', seg(c.usage, 't-b')]); line('    ' + c.desc, 'mut'); } else line(['  ', seg(fit(c.usage, 28), 't-b'), seg(c.desc, 't-mut')]); });
    });
    rule(); line('Tab: 자동완성 · ↑↓: 이전 명령 · 코드를 클릭하면 바로 열람 · 한글 명령도 사용 가능', 'dim');
  });

  def(['ls', '목록'], '조회', 'ls [유형]', '파일 목록 (유형: chr org loc itm lor)', function (a) {
    var t = a[0] ? TYPEMAP[a[0].toLowerCase()] : null;
    if (a[0] && !t) return err('알 수 없는 유형: ' + a[0] + ' (chr org loc itm lor)');
    var list = db().entities.filter(function (e) { return !t || e.type === t; }).sort(function (x, y) { return x.type === y.type ? x.no - y.no : R.TYPES.findIndex(function (k) { return k.id === x.type; }) - R.TYPES.findIndex(function (k) { return k.id === y.type; }); });
    if (!list.length) { line(db().entities.length ? '해당 유형의 파일이 없습니다.' : '보관소가 비어 있습니다. new 또는 sample 을 입력하십시오.', 'mut'); return; }
    var narrow = cols() < 72;
    if (!narrow) line([seg(fit('CODE', 11), 't-dim'), seg(fit('CLEARANCE', 15), 't-dim'), seg(fit('NAME', 22), 't-dim'), seg('ALIAS / STATUS', 't-dim')]);
    rule('·');
    list.forEach(function (e) {
      var extra = [e.alias, e.status].filter(Boolean).join(' · ');
      if (narrow) {
        line([link(R.code(e), 'cat ' + R.code(e)), '  ', seg(R.CLEAR[e.clearance].code, e.clearance >= 2 ? 't-hi' : 't-mut')]);
        line(['  ', seg(e.name, 't-b'), extra ? seg('  ' + extra, 't-mut') : null]);
      } else line([link(R.code(e), 'cat ' + R.code(e)), '  ', seg(fit(R.CLEAR[e.clearance].code, 14), e.clearance >= 2 ? 't-hi' : 't-mut'), ' ', seg(fit(e.name, 22), 't-b'), seg(extra, 't-mut')]);
    });
    rule('·'); line('총 ' + list.length + '건', 'dim');
  });

  def(['find', '검색', 'grep'], '조회', 'find <키워드>', '이름 · 내용 · 태그 · 항목 전체 검색', function (a) {
    var q = a.join(' ').trim().toLowerCase(); if (!q) return err('키워드를 입력하십시오.');
    var hits = db().entities.filter(function (e) {
      return [e.name, e.alias, e.summary, e.body, e.status, R.code(e), e.tags.join(' '), e.fields.map(function (f) { return f.k + ' ' + f.v; }).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var evs = db().events.filter(function (v) { return (v.title + ' ' + v.desc + ' ' + v.date).toLowerCase().indexOf(q) >= 0; });
    if (!hits.length && !evs.length) return line('"' + q + '" 검색 결과 없음', 'mut');
    hits.forEach(function (e) { line([link(R.code(e), 'cat ' + R.code(e)), '  ', seg(e.name, 't-b'), '  ', seg(e.summary || '', 't-mut')]); });
    evs.forEach(function (v) { line([seg('EVENT    ', 't-dim'), seg((v.date || '날짜 미상') + '  ', 't-hi'), v.title]); });
    line('파일 ' + hits.length + ' · 사건 ' + evs.length + '건', 'dim');
  });

  def(['cat', 'view', '열람'], '조회', 'cat <대상>', '파일 열람 (코드 · 이름 · 별칭)', function (a) {
    withTarget(a.join(' '), function (e) {
      R.log('SYS', '파일 열람 ' + R.code(e));
      var t = R.type(e.type);
      rule('═');
      line([seg(R.code(e), 't-hi'), '   ', seg(t.name, 't-mut'), '   ', clr(e)]);
      line(e.name + (e.alias ? '  //  ' + e.alias : ''), 'h1');
      if (e.summary) line(e.summary, 'mut');
      if (e.tags.length) line(e.tags.map(function (g) { return '#' + g; }).join(' '), 'dim');
      rule('─');
      var facts = (e.status ? [{ k: '상태', v: e.status }] : []).concat(e.fields);
      facts.forEach(function (f) { line([seg(fit(f.k, 14), 't-dim'), f.v]); });
      if (e.body) {
        if (facts.length) blank();
        e.body.split('\n').forEach(function (ln) {
          var parts = [], re = /\|\|([\s\S]+?)\|\|/g, last = 0, m;
          while ((m = re.exec(ln))) {
            if (m.index > last) parts.push(ln.slice(last, m.index));
            var span = h('span', { class: 't-red', title: '클릭하여 열람' }, m[1]);
            span.addEventListener('click', function () { this.classList.toggle('show'); R.sound.key(); });
            parts.push(span); last = re.lastIndex;
          }
          parts.push(ln.slice(last) || (parts.length ? '' : ' '));
          line(parts);
        });
      }
      var links = db().links.filter(function (l) { return l.a === e.id || l.b === e.id; });
      if (links.length) {
        blank(); line('LINKS', 'ok');
        links.forEach(function (l) {
          var o = db().entities.find(function (x) { return x.id === (l.a === e.id ? l.b : l.a); }); if (!o) return;
          line(['  ', seg(l.a === e.id ? '→ ' : '← ', 't-hi'), seg(fit(l.label || '관계', 12), 't-mut'), link(R.code(o), 'cat ' + R.code(o)), '  ', o.name]);
        });
      }
      var evs = db().events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
      if (evs.length) {
        blank(); line('EVENTS', 'ok');
        evs.forEach(function (v) { line(['  ', seg(fit(v.date || '날짜 미상', 14), 't-hi'), v.title]); });
      }
      rule('═');
      line([seg('편집: ', 't-dim'), link('edit ' + R.code(e), 'edit ' + R.code(e)), seg('   관계도: ', 't-dim'), link('graph ' + R.code(e), 'graph ' + R.code(e))]);
    });
  });

  def(['links', '관계'], '조회', 'links <대상>', '대상의 관계 목록', function (a) {
    withTarget(a.join(' '), function (e) {
      var ls = db().links.filter(function (l) { return l.a === e.id || l.b === e.id; });
      if (!ls.length) return line(R.code(e) + ' 에 연결된 관계가 없습니다.', 'mut');
      ls.forEach(function (l) {
        var A = db().entities.find(function (x) { return x.id === l.a; }), B = db().entities.find(function (x) { return x.id === l.b; });
        line([link(R.code(A), 'cat ' + R.code(A)), ' ─[', seg(l.label || '관계', 't-hi'), ']→ ', link(R.code(B), 'cat ' + R.code(B)), '  ', seg(A.name + ' → ' + B.name, 't-mut')]);
      });
    });
  });

  def(['events', '사건'], '조회', 'events [대상]', '사건 연대기 (대상 지정 시 관련 사건만)', function (a) {
    var show = function (target) {
      var evs = db().events.filter(function (v) { return !target || v.entities.indexOf(target.id) >= 0; }).sort(R.byDate);
      if (!evs.length) return line('기록된 사건이 없습니다. timeline 모듈에서 추가하십시오.', 'mut');
      evs.forEach(function (v) {
        line([seg(v.major ? '◆ ' : '◇ ', 't-hi'), seg(fit(v.date || '날짜 미상', 14), 't-hi'), seg(v.title, v.major ? 't-b' : '')]);
        if (v.desc) line('                ' + v.desc, 'mut');
        var names = v.entities.map(function (id) { var e = db().entities.find(function (x) { return x.id === id; }); return e ? R.code(e) : null; }).filter(Boolean);
        if (names.length) line(['                ', seg(names.join(' · '), 't-dim')]);
      });
    };
    if (a.length) withTarget(a.join(' '), show); else show(null);
  });

  def(['stat', '현황'], '조회', 'stat', '보관소 현황', function () {
    var d = db();
    line('보관소 현황', 'h1'); rule();
    R.TYPES.forEach(function (t) { line([seg(fit(t.code + ' ' + t.name, 14), 't-mut'), String(d.entities.filter(function (e) { return e.type === t.id; }).length)]); });
    rule('·');
    R.CLEAR.forEach(function (c) { line([seg(fit(c.code, 14), 't-mut'), String(d.entities.filter(function (e) { return e.clearance === c.n; }).length)]); });
    rule('·');
    line([seg(fit('관계', 14), 't-mut'), String(d.links.length)]);
    line([seg(fit('사건', 14), 't-mut'), String(d.events.length)]);
    line([seg(fit('로그', 14), 't-mut'), String(d.logs.length)]);
  });

  def(['new', '신규'], '기록', 'new [유형]', '새 파일 작성 (편집 모듈 열림)', function (a) {
    var t = a[0] ? TYPEMAP[a[0].toLowerCase()] : 'character';
    if (!t) return err('알 수 없는 유형: ' + a[0]);
    line('편집 모듈을 엽니다 · ' + R.type(t).name, 'mut');
    R.go('files', { create: t });
  });
  def(['edit', '편집'], '기록', 'edit <대상>', '파일 편집', function (a) {
    withTarget(a.join(' '), function (e) { line(R.code(e) + ' 편집 모듈을 엽니다', 'mut'); R.go('files', { select: e.id, edit: true }); });
  });
  def(['rm', '삭제', 'del'], '기록', 'rm <대상>', '파일 삭제 (확인 필요)', function (a) {
    withTarget(a.join(' '), function (e) {
      line([seg('경고 ', 't-tag'), ' ' + R.code(e) + ' ' + e.name + ' 파일과 연결 관계를 삭제합니다.'], 'warn');
      line("계속하려면 'yes' 를 입력하십시오.", 'warn');
      pending = function (ans) {
        if (!/^(y|yes|예|네)$/i.test(ans)) return line('취소했습니다.', 'mut');
        var d = db();
        d.entities = d.entities.filter(function (x) { return x.id !== e.id; });
        d.links = d.links.filter(function (l) { return l.a !== e.id && l.b !== e.id; });
        d.events.forEach(function (v) { v.entities = v.entities.filter(function (id) { return id !== e.id; }); });
        R.log('DATA', '파일 삭제 ' + R.code(e) + ' ' + e.name); R.store.save(); R.fx.radarData();
        ok(R.code(e) + ' 삭제 완료');
      };
    });
  });
  def(['link', '연결'], '기록', 'link <A> <B> [관계]', 'A → B 관계 연결', function (a) {
    if (a.length < 2) return err('사용법: link CHR-0001 ORG-0002 소속');
    var A = resolve(a[0]), B = resolve(a[1]);
    if (!A.e) return err('A: ' + (A.err || '후보가 여러 개 · 코드를 사용하십시오'));
    if (!B.e) return err('B: ' + (B.err || '후보가 여러 개 · 코드를 사용하십시오'));
    if (A.e.id === B.e.id) return err('같은 파일끼리는 연결할 수 없습니다.');
    var label = a.slice(2).join(' ');
    db().links.push({ id: R.uid(), a: A.e.id, b: B.e.id, label: label });
    R.log('DATA', '관계 연결 ' + R.code(A.e) + ' → ' + R.code(B.e) + (label ? ' [' + label + ']' : ''));
    R.store.save(); R.fx.radarData();
    ok(R.code(A.e) + ' ─[' + (label || '관계') + ']→ ' + R.code(B.e));
  });
  def(['unlink', '해제'], '기록', 'unlink <A> <B>', 'A, B 사이 관계 모두 해제', function (a) {
    if (a.length < 2) return err('사용법: unlink CHR-0001 ORG-0002');
    var A = resolve(a[0]), B = resolve(a[1]);
    if (!A.e || !B.e) return err('대상을 찾을 수 없습니다.');
    var n = db().links.length;
    db().links = db().links.filter(function (l) { return !((l.a === A.e.id && l.b === B.e.id) || (l.a === B.e.id && l.b === A.e.id)); });
    n -= db().links.length;
    if (!n) return line('해제할 관계가 없습니다.', 'mut');
    R.log('DATA', '관계 해제 ' + R.code(A.e) + ' — ' + R.code(B.e)); R.store.save(); R.fx.radarData();
    ok(n + '건 해제');
  });
  def(['sample', '예시'], '기록', 'sample', '예시 기록 불러오기', function () { R.sample(); R.fx.radarData(); ok('예시 기록 5건 생성 · ls 로 확인'); });

  def(['files', '파일'], '모듈', 'files', '파일 모듈 (목록 · 열람 · 편집)', function () { R.go('files'); });
  def(['graph', '관계도'], '모듈', 'graph [대상]', '관계도 모듈', function (a) {
    if (!a.length) return R.go('graph');
    withTarget(a.join(' '), function (e) { R.go('graph', { focus: e.id }); });
  });
  def(['timeline', '타임라인'], '모듈', 'timeline', '타임라인 모듈 (사건 추가 · 편집)', function () { R.go('timeline'); });
  def(['security', '보안'], '모듈', 'security', '보안 · 백업 모듈', function () { R.go('security'); });

  def(['passwd', '코드변경'], '보안', 'passwd', '접속 코드 변경', function () { R.actions.changeCode(); });
  def(['export', '내보내기'], '보안', 'export [--plain]', '암호화 백업 (--plain: 일반 JSON)', function (a) { if (a[0] === '--plain') R.actions.exportPlain(); else R.actions.exportEnc(); });
  def(['import', '가져오기'], '보안', 'import', '백업 파일 가져오기', function () { R.actions.importBackup(); });
  def(['lock', '잠금'], '보안', 'lock', '즉시 잠금 (Ctrl+L)', function () { R.lock(); });

  def(['clear', 'cls', '지우기'], '시스템', 'clear', '터미널 화면 지우기', function () { out.innerHTML = ''; nextAt = 0; });
  def(['log', '로그'], '시스템', 'log [clear]', '로그 창 비우기 (clear)', function (a) {
    if (a[0] !== 'clear') return line('시스템 로그 ' + db().logs.length + '건 · 오른쪽 로그 창에 표시 중', 'mut');
    db().logs = []; R.store.save(); R.logwin.render(); R.log('SEC', '시스템 로그 초기화'); ok('로그를 비웠습니다');
  });
  def(['history', '기록'], '시스템', 'history', '이번 세션에 입력한 명령', function () {
    if (!hist.length) return line('기록 없음', 'mut');
    hist.slice().reverse().forEach(function (c, i) { line([seg(String(i + 1).padStart(4, ' ') + '  ', 't-dim'), c]); });
  });
  def(['whoami'], '시스템', 'whoami', '현재 세션 정보', function () {
    line([seg(fit('USER', 12), 't-dim'), 'agent']); line([seg(fit('CLEARANCE', 12), 't-dim'), 'LEVEL 3']);
    line([seg(fit('SESSION', 12), 't-dim'), R.sessionId]); line([seg(fit('VAULT', 12), 't-dim'), 'AES-256-GCM · LOCAL']);
  });
  def(['date', '시각'], '시스템', 'date', '현재 시각', function () { line(new Date().toLocaleString('ko-KR')); });

  /* ── 실행 ── */
  function split(s) {
    var a = [], m, re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    while ((m = re.exec(s))) a.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
    return a;
  }
  function run(raw, echo) {
    raw = raw.trim();
    line([seg('agent@rss:~$ ', 'ps'), raw], 'cmd');
    if (!raw) return;
    if (hist[0] !== raw) hist.unshift(raw);
    if (hist.length > 200) hist.pop();
    hi = -1;
    if (pending) { var p = pending; pending = null; p(raw); return; }
    var a = split(raw), name = a.shift().toLowerCase(), c = C[name];
    if (!c) { err("'" + name + "' 명령을 찾을 수 없습니다. help 를 입력하십시오."); return; }
    try { c.run(a, raw); } catch (e) { console.error(e); err('실행 오류: ' + e.message); }
    void echo;
  }

  function complete() {
    var v = input.value, parts = v.split(/\s+/);
    if (parts.length <= 1) {
      var m = Object.keys(C).filter(function (k) { return /^[a-z]/.test(k) && k.indexOf(parts[0].toLowerCase()) === 0; });
      if (m.length === 1) input.value = m[0] + ' ';
      else if (m.length > 1) line(m.join('   '), 'dim');
      return;
    }
    var last = parts[parts.length - 1].toLowerCase();
    var cands = db().entities.map(function (e) { return R.code(e); }).filter(function (c) { return c.toLowerCase().indexOf(last) === 0; });
    if (!cands.length) cands = db().entities.filter(function (e) { return e.name.toLowerCase().indexOf(last) === 0; }).map(function (e) { return e.name.indexOf(' ') >= 0 ? '"' + e.name + '"' : e.name; });
    if (cands.length === 1) { parts[parts.length - 1] = cands[0]; input.value = parts.join(' ') + ' '; }
    else if (cands.length > 1) line(cands.slice(0, 30).join('   '), 'dim');
  }

  R.term = {
    init: function () {
      out = $('#termOut'); input = $('#termIn'); form = $('#termForm');
      form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; run(v); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') { e.preventDefault(); complete(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; } else { hi = -1; input.value = ''; } }
        else if (e.key === 'l' && e.ctrlKey) { /* Ctrl+L 은 잠금 (main.js) */ }
        else if (e.key.length === 1) R.sound.type();
      });
      $('#term').addEventListener('mouseup', function () { if (!window.getSelection().toString()) input.focus(); });
    },
    focus: function () { if (input) input.focus(); },
    run: run,
    boot: function () {
      out.innerHTML = ''; nextAt = performance.now() + 500; pending = null;
      var d = db();
      var prev = d.logs.filter(function (x) { return /^ACCESS GRANTED/.test(x.m); });
      var last = prev.length > 1 ? prev[prev.length - 2] : null;
      line('R.S.S. CENTRAL ARCHIVE  ·  SECURE SHELL v' + R.version, 'h1');
      rule('═');
      ok('신원 인증 완료 · CLEARANCE LEVEL 3');
      ok('보관소 복호화 · AES-256-GCM / PBKDF2-SHA256');
      ok('색인 적재 · 파일 ' + d.entities.length + ' · 관계 ' + d.links.length + ' · 사건 ' + d.events.length);
      ok('세션 개설 · ' + R.sessionId);
      rule('═');
      if (last) { var t = new Date(last.t); line('마지막 접속  ' + t.getFullYear() + '-' + R.p2(t.getMonth() + 1) + '-' + R.p2(t.getDate()) + ' ' + R.p2(t.getHours()) + ':' + R.p2(t.getMinutes()), 'mut'); }
      if (!d.entities.length) line(["보관소가 비어 있습니다. ", link('new', 'new'), " 로 첫 파일을 작성하거나 ", link('sample', 'sample'), " 로 예시 기록을 불러오십시오."], 'warn');
      line([link('help', 'help'), seg(' 명령어 목록   ', 't-dim'), link('ls', 'ls'), seg(' 파일 목록   ', 't-dim'), link('graph', 'graph'), seg(' 관계도   ', 't-dim'), link('timeline', 'timeline'), seg(' 타임라인', 't-dim')]);
      blank();
    }
  };

  /* ───────── 로그 창 ───────── */
  var logEl, lastDay = '';
  function dayOf(t) { var d = new Date(t); return d.getFullYear() + '.' + R.p2(d.getMonth() + 1) + '.' + R.p2(d.getDate()); }
  function logRow(x, fresh) {
    var day = dayOf(x.t);
    if (day !== lastDay) { logEl.appendChild(h('div', { class: 'lg-day' }, '── ' + day + ' ──')); lastDay = day; }
    var d = new Date(x.t);
    logEl.appendChild(h('div', { class: 'lg' + (fresh ? ' new' : '') },
      h('span', { class: 'lg-t' }, R.p2(d.getHours()) + ':' + R.p2(d.getMinutes()) + ':' + R.p2(d.getSeconds())),
      h('span', { class: 'lg-l ' + x.l }, x.l),
      h('span', { class: 'lg-m' }, x.m)));
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
        if (x.l === 'DATA') R.fx.radarData();
      });
    },
    render: function () {
      logEl.innerHTML = ''; lastDay = '';
      db().logs.forEach(function (x) { logRow(x, false); });
      logEl.scrollTop = logEl.scrollHeight;
      $('#logCount').textContent = db().logs.length + ' ENTRIES';
    }
  };
})();
