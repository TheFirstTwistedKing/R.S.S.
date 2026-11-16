/* 화면: 공용 모달, 파일(인물·세계관 데이터), 타임라인, 보안·백업 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var db = function () { return R.store.db; };
  var byId = function (id) { return R.A.entities.find(function (e) { return e.id === id; }); };
  var touch = function (e) { if (e) e.updated = Date.now(); R.store.save(); };

  /* ───────── 모달 ───────── */
  var ui = R.ui = {};
  ui.open = function (title, body, buttons, wide) {
    var m = $('#modal'); m.innerHTML = '';
    var close = function () { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    var foot = h('div', { class: 'dialog-f' });
    (buttons || []).forEach(function (b) {
      foot.appendChild(h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: function () { if (b.run(close) !== false) {} } }, b.label));
    });
    var dlg = h('div', { class: 'dialog' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'dialog-h' }, h('h3', { text: title }), h('button', { class: 'x', type: 'button', 'aria-label': R.T('닫기', 'Close'), onclick: close }, 'X')),
      h('div', { class: 'dialog-b' }, body),
      buttons && buttons.length ? foot : null);
    m.appendChild(dlg);
    m.hidden = false;
    // 창이 열릴 때 여러 언어 글자가 쏟아지는 연출
    m.classList.remove('opening'); void m.offsetWidth; m.classList.add('opening');
    if (R.fx && R.fx.rainOpen) R.fx.rainOpen(dlg);
    // 'opening' 표시는 그대로 둠: 떼면 기본 등장 애니메이션이 다시 재생되어 창이 한 번 더 깜빡임
    m.onclick = function (e) { if (e.target === m) close(); };
    document.addEventListener('keydown', esc);
    var f = dlg.querySelector('input, textarea, select'); if (f) setTimeout(function () { f.focus(); }, 30);
    return close;
  };
  ui.confirm = function (title, msg, okLabel, danger) {
    return new Promise(function (res) {
      var done = false;
      var close = ui.open(title, h('p', { text: msg }), [
        { label: R.T('취소', 'Cancel'), cls: 'ghost', run: function (c) { done = true; c(); res(false); } },
        { label: okLabel || R.T('확인', 'OK'), cls: danger ? 'danger' : 'primary', run: function (c) { done = true; c(); res(true); } }
      ]);
      var m = $('#modal'), obs = new MutationObserver(function () { if (m.hidden && !done) { done = true; res(false); obs.disconnect(); } else if (done) obs.disconnect(); });
      obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
      void close;
    });
  };
  ui.codePrompt = function (title, msg) {
    return new Promise(function (res) {
      var inp = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', placeholder: R.T('숫자 4~8자리', '4–8 digits'), autocomplete: 'off' });
      var done = false;
      var ok = function (c) { done = true; c(); res(inp.value); };
      var close = ui.open(title, [h('p', { text: msg }), h('label', { class: 'field' }, h('span', null, 'CODE'), inp)], [
        { label: R.T('취소', 'Cancel'), cls: 'ghost', run: function (c) { done = true; c(); res(null); } },
        { label: R.T('확인', 'OK'), cls: 'primary', run: ok }
      ]);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(close); });
      var m = $('#modal'), obs = new MutationObserver(function () { if (m.hidden) { obs.disconnect(); if (!done) res(null); } });
      obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
    });
  };

  function clrBadge(n) { var c = R.CLEAR[n] || R.CLEAR[0]; return h('span', { class: 'clr c' + c.n, title: c.name }, c.code); }
  function thumb(e, cls) {
    return h('div', { class: cls || 'thumb' }, e.image ? h('img', { src: e.image, alt: '' }) : R.type(e.type).code);
  }
  function renderBody(text) {
    // ||가려진 문장|| → 검은 막대. 누르면 드러남
    var out = R.esc(text).replace(/\|\|([\s\S]+?)\|\|/g, '<span class="redact" title="열람하려면 클릭">$1</span>');
    var d = h('div', { class: 'body-text', html: out });
    d.addEventListener('click', function (ev) { var r = ev.target.closest('.redact'); if (r) { r.classList.toggle('show'); R.sound.key(); } });
    return d;
  }
  var REL = [R.T('동료', 'colleague'), R.T('상관', 'superior'), R.T('부하', 'subordinate'), R.T('가족', 'family'), R.T('연인', 'partner'), R.T('적대', 'hostile'), R.T('라이벌', 'rival'), R.T('정보원', 'informant'), R.T('감시 대상', 'surveillance target'), R.T('소속', 'member of'), R.T('본거지', 'based at'), R.T('소유', 'owns'), R.T('협력', 'cooperates'), R.T('거래', 'trades with')];

  /* ───────── 파일 뷰 ───────── */
  var F = { type: 'all', q: '', sel: null, edit: false };
  R.views = {};
  R.views.files = function (root, opts) {
    F.edit = false;
    if (opts && opts.select) { F.sel = opts.select; F.type = 'all'; F.q = ''; }
    var wrap = h('div', { class: 'files' + (F.sel || F.edit ? ' show-detail' : '') });
    var listPane = h('section', { class: 'list-pane' });
    var detailPane = h('section', { class: 'detail-pane' });
    wrap.appendChild(listPane); wrap.appendChild(detailPane);
    root.appendChild(wrap);

    function counts() {
      var c = { all: R.A.entities.length + R.SEALED.length };
      R.TYPES.forEach(function (t) { c[t.id] = 0; });
      R.A.entities.concat(R.SEALED).forEach(function (e) { c[e.type]++; });
      return c;
    }
    function filtered() {
      var q = F.q.trim().toLowerCase();
      var own = R.A.entities.filter(function (e) {
        if (F.type !== 'all' && e.type !== F.type) return false;
        if (!q) return true;
        return [e.name, e.alias, e.summary, e.body, e.status, R.code(e), e.tags.join(' '), e.fields.map(function (f) { return f.k + ' ' + f.v; }).join(' ')]
          .join(' ').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return b.updated - a.updated; });
      // 봉인 문서는 제목·코드로만 검색됨 (내용은 공개되지 않음)
      var sealed = R.SEALED.filter(function (s) { return (F.type === 'all' || F.type === s.type) && (!q || (s.name + ' ' + s.alias + ' ' + s.code).toLowerCase().indexOf(q) >= 0); });
      return own.concat(sealed);
    }

    var search = h('input', { class: 'input', type: 'search', placeholder: R.T('이름 · 코드 · 태그 · 내용 검색', 'Search name · code · tag · text'), value: F.q });
    var tabs = h('div', { class: 'tabs' });
    var list = h('div', { class: 'list' });
    listPane.appendChild(h('div', { class: 'list-tools' },
      h('div', { class: 'row' }, search, h('span', { class: 'ro-badge' }, R.T('열람 전용', 'READ ONLY'))),
      tabs));
    listPane.appendChild(list);
    search.addEventListener('input', function () { F.q = search.value; drawList(); });

    function drawTabs() {
      var c = counts(); tabs.innerHTML = '';
      [{ id: 'all', name: R.T('전체', 'All') }].concat(R.TYPES).forEach(function (t) {
        tabs.appendChild(h('button', { class: 'tab' + (F.type === t.id ? ' on' : ''), type: 'button', onclick: function () { F.type = t.id; drawTabs(); drawList(); } },
          t.name, h('span', { class: 'n' }, c[t.id])));
      });
    }
    function drawList() {
      list.innerHTML = '';
      var items = filtered();
      if (!items.length) {
        list.appendChild(h('div', { style: { padding: '16px', color: 'var(--muted)' } }, R.T('조건에 맞는 문서가 없습니다.', 'No documents match.')));
        return;
      }
      items.forEach(function (e) {
        list.appendChild(h('button', { class: 'item' + (e.sealed ? ' sealed' : '') + (F.sel === e.id ? ' on' : ''), type: 'button', onclick: function () { F.sel = e.id; F.edit = false; R.sound.nav(); draw(); } },
          e.sealed ? h('div', { class: 'thumb' }, 'LOCK') : thumb(e),
          h('div', { class: 'item-t' }, e.name),
          h('div', { class: 'item-c' }, e.sealed ? h('span', { class: 'clr sealed' }, 'SEALED') : clrBadge(e.clearance)),
          h('div', { class: 'item-s' }, R.code(e) + (e.sealed ? ' · ' + e.status : (e.alias ? ' · ' + e.alias : '')))));
      });
    }

    /* 봉인 문서를 열면: 접근 불가 */
    function deniedView(s) {
      R.log('WARN', R.T('봉인 문서 접근 시도 ', 'Sealed document access attempt ') + s.code + R.T(' · 거부', ' · denied'));
      R.sound.deny();
      var box = h('article', { class: 'dossier denied view-in' },
        h('button', { class: 'btn ghost back', type: 'button', onclick: function () { F.sel = null; draw(); } }, R.T('< 목록', '< List')),
        h('div', { class: 'deny-code' }, s.code + '  ·  ' + R.type(s.type).name),
        h('h2', { class: 'deny-title' }, 'ACCESS DENIED'),
        h('p', { class: 'deny-ko' }, R.T('접근 불가', 'ACCESS DENIED')),
        h('div', { class: 'deny-bar' }),
        h('div', { class: 'facts' },
          h('div', { class: 'k' }, R.T('문서', 'Document')), h('div', null, s.name),
          h('div', { class: 'k' }, R.T('상태', 'Status')), h('div', null, R.T('작성 미완료', 'Draft incomplete')),
          h('div', { class: 'k' }, R.T('열람 승인', 'Approval')), h('div', null, R.T('없음', 'None')),
          h('div', { class: 'k' }, R.T('등급', 'Clearance')), h('div', null, R.CLEAR[s.clearance].code)),
        h('p', { class: 'hint', style: { marginTop: '16px' } }, R.T('이 문서는 아직 완성되지 않았고 열람 승인을 얻지 못했습니다. 접근 시도는 시스템 로그에 기록됩니다.', 'This document is not finished and has not been cleared for access. The attempt has been logged.')));
      return box;
    }

    function drawDetail() {
      detailPane.innerHTML = '';
      wrap.classList.toggle('show-detail', !!(F.sel || F.edit));
      var back = h('button', { class: 'btn ghost back', type: 'button', onclick: function () { F.sel = null; F.edit = false; draw(); } }, R.T('< 목록', '< List'));
      var sealed = F.sel && R.SEALED.find(function (s) { return s.id === F.sel; });
      if (sealed) { var dv = deniedView(sealed); detailPane.appendChild(dv); R.decodeTree(dv, '.deny-code, .deny-ko, .facts > div', 45); return; }
      var e = F.sel && byId(F.sel);
      if (!e) {
        F.sel = null;
        var doc = h('div', { class: 'dossier' });
        doc.appendChild(R.A.entities.length
          ? h('div', { class: 'empty' }, h('h3', null, R.T('문서를 선택하십시오', 'Select a document')), h('p', null, R.T('왼쪽 목록에서 열람할 문서를 고르십시오. 이 아카이브는 열람 전용입니다.', 'Pick a document from the list. This archive is read-only.')))
          : h('div', { class: 'empty' }, h('h3', null, R.T('공개된 문서가 아직 없습니다', 'No documents released yet')),
              h('p', null, R.T('이 아카이브는 열람 전용입니다. 문서는 앱 업데이트로 추가됩니다.', 'This archive is read-only. Documents arrive with app updates.'))));
        detailPane.appendChild(doc);
        return;
      }
      var t = R.type(e.type);
      var doc2 = h('article', { class: 'dossier view-in cls-' + e.clearance, 'data-stamp': R.CLEAR[e.clearance].code });
      doc2.appendChild(back);
      doc2.appendChild(h('div', { class: 'dz-head' },
        thumb(e, 'portrait'),
        h('div', null,
          h('div', { class: 'dz-id' }, h('span', null, R.code(e)), h('span', { style: { color: 'var(--faint)' } }, t.name), clrBadge(e.clearance)),
          h('h2', { class: 'dz-title' }, e.name),
          e.alias ? h('div', { class: 'dz-alias' }, e.alias) : null,
          e.summary ? h('p', { class: 'dz-summary' }, e.summary) : null,
          e.tags.length ? h('div', { class: 'tags' }, e.tags.map(function (g) { return h('span', { class: 'tag' }, g); })) : null,
          h('div', { class: 'dz-actions' },
            h('button', { class: 'btn', type: 'button', onclick: function () { R.go('graph', { focus: e.id }); } }, R.T('관계도에서 보기', 'Show in graph'))))));

      var facts = [];
      if (e.status) facts.push({ k: R.T('상태', 'Status'), v: e.status });
      facts = facts.concat(e.fields);
      if (facts.length) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, R.T('DATA · 기본 정보', 'DATA · FIELDS'))),
          h('div', { class: 'facts' }, facts.map(function (f) { return [h('div', { class: 'k' }, f.k || '-'), h('div', null, f.v)]; }))));
      }
      if (e.body) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, R.T('RECORD · 기록', 'RECORD'))), renderBody(e.body)));
      }
      var links = R.A.links.filter(function (l) { return l.a === e.id || l.b === e.id; });
      doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, R.T('LINKS · 관계 ', 'LINKS · ') + links.length)),
        links.length ? h('div', { class: 'links' }, links.map(function (l) {
          var o = byId(l.a === e.id ? l.b : l.a); if (!o) return null;
          return h('div', { class: 'link-row' },
            h('button', { class: 'go', type: 'button', onclick: function () { F.sel = o.id; draw(); } },
              h('span', { class: 'ln-rel' }, (l.a === e.id ? '→ ' : '← ') + (l.label || R.T('관계', 'link'))), h('span', { class: 'ln-name' }, o.name), h('span', { class: 'ln-id' }, R.code(o))),
            h('span'));
        })) : h('p', { style: { color: 'var(--muted)', margin: 0 } }, R.T('연결된 파일이 없습니다.', 'No linked documents.'))));

      var evs = R.A.events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
      if (evs.length) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, R.T('EVENTS · 관련 사건 ', 'EVENTS · ') + evs.length)),
          h('div', { class: 'links' }, evs.map(function (v) {
            return h('div', { class: 'link-row' }, h('button', { class: 'go', type: 'button', onclick: function () { R.go('timeline', { entity: e.id }); } },
              h('span', { class: 'ln-id', style: { color: 'var(--accent)' } }, v.date || R.T('날짜 미상', 'undated')), h('span', { class: 'ln-name' }, v.title)), h('span'));
          }))));
      }
      detailPane.appendChild(doc2);
      R.decodeTree(doc2, '.dz-id span, .dz-title, .dz-alias, .dz-summary, .facts > div, .ln-name, .ln-id, .ln-rel, .label', 35);
    }

    function draw() { drawTabs(); drawList(); drawDetail(); }
    R.decodeTree(listPane, '.item-t, .item-s', 40);
    draw();
  };

  /* ───────── 타임라인 ───────── */
  R.byDate = function (a, b) {
    if (!a.date && b.date) return 1; if (a.date && !b.date) return -1;
    return a.date.localeCompare(b.date, 'ko', { numeric: true }) || a.title.localeCompare(b.title, 'ko');
  };
  var T = { entity: '' };
  R.views.timeline = function (root, opts) {
    if (opts && opts.entity !== undefined) T.entity = opts.entity;
    var scroll = h('div', { class: 'tl' }), inner = h('div', { class: 'tl-inner' });
    scroll.appendChild(inner); root.appendChild(scroll);
    var filter = h('select', { class: 'select' }, h('option', { value: '' }, R.T('전체 사건', 'All events')),
      R.A.entities.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).map(function (e) {
        var o = h('option', { value: e.id }, R.code(e) + ' · ' + e.name); if (T.entity === e.id) o.selected = true; return o;
      }));
    filter.addEventListener('change', function () { T.entity = filter.value; drawList(); });
    inner.appendChild(h('div', { class: 'tl-tools' }, filter,
      h('span', { class: 'hint' }, R.T('날짜는 자유 형식 (예: 2024-03-11, 제국력 312.4) · 숫자 순 정렬', 'Free-form dates (e.g. 2024-03-11, Year 312.4) · sorted numerically'))));
    var list = h('div', { class: 'tl-list' }); inner.appendChild(list);
    function drawList() {
      list.innerHTML = ''; list.classList.remove('no-line');
      var evs = R.A.events.filter(function (v) { return !T.entity || v.entities.indexOf(T.entity) >= 0; }).sort(R.byDate);
      list.style.display = evs.length ? '' : 'block';
      if (!evs.length) {
        list.appendChild(h('div', { class: 'empty' }, h('h3', null, T.entity ? R.T('관련 사건이 없습니다', 'No related events') : R.T('기록된 사건이 없습니다', 'No events recorded')), h('p', null, R.T('사건을 추가하고 관련 파일을 연결하면 시간순으로 정리됩니다.', 'Add events and link documents to build a chronology.'))));
        list.classList.add('no-line');
        return;
      }
      evs.forEach(function (v) {
        list.appendChild(h('div', { class: 'ev' + (v.major ? ' major' : '') },
          h('div', { class: 'ev-date' }, v.date || R.T('날짜 미상', 'undated')),
          h('div', { class: 'ev-dot' }),
          h('div', { class: 'ev-card ro' },
            h('h4', null, v.title),
            v.desc ? h('p', null, v.desc) : null,
            v.entities.length ? h('div', { class: 'ev-ents' }, v.entities.map(function (id) {
              var e = byId(id); if (!e) return null;
              return h('button', { class: 'ev-ent', type: 'button', onclick: function () { R.go('files', { select: id }); } }, e.name);
            })) : null)));
      });
      R.decodeTree(list, '.ev-date, .ev-card h4, .ev-card p', 40);
    }
    drawList();
  };

  /* ───────── 보안 · 백업 ───────── */
  R.views.security = function (root) {
    var d = R.store.db, A0 = R.A;
    var scroll = h('div', { class: 'sec-view' }), inner = h('div', { class: 'sec-inner view-in' });
    scroll.appendChild(inner); root.appendChild(scroll);
    inner.appendChild(h('div', { class: 'stat' },
      [[R.T('문서', 'Documents'), A0.entities.length + R.SEALED.length], [R.T('관계', 'Links'), A0.links.length], [R.T('사건', 'Events'), A0.events.length], [R.T('봉인', 'Sealed'), R.SEALED.length]]
        .map(function (s) { return h('div', null, h('b', null, s[1]), h('span', null, s[0])); })));

    var auto = h('select', { class: 'select', style: { width: 'auto', minWidth: '160px' } },
      [[0, R.T('사용 안 함', 'Off')], [3, R.T('3분', '3 min')], [5, R.T('5분', '5 min')], [10, R.T('10분', '10 min')], [30, R.T('30분', '30 min')]].map(function (o) {
        var op = h('option', { value: o[0] }, o[1]); if (d.settings.autoLock === o[0]) op.selected = true; return op;
      }));
    auto.addEventListener('change', function () { d.settings.autoLock = +auto.value; R.log('SEC', R.T('자동 잠금 설정: ', 'Auto lock: ') + auto.selectedOptions[0].textContent); touch(); R.resetIdle(); R.toast(R.T('자동 잠금: ', 'Auto lock: ') + auto.selectedOptions[0].textContent); });

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, R.T('접속 코드', 'Access code')),
      h('p', null, R.T('시스템 로그와 설정은 접속 코드로 암호화(AES-256-GCM)되어 이 PC에만 저장됩니다. 코드를 잊으면 복구할 수 없습니다.', 'System logs and settings are encrypted with your access code (AES-256-GCM) and stored only on this PC. A forgotten code cannot be recovered.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: changeCode }, R.T('코드 변경', 'Change code')),
        h('span', { class: 'label', style: { marginLeft: '8px' } }, R.T('자동 잠금', 'Auto lock')), auto)));

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, R.T('백업', 'Backup')),
      h('p', null, R.T('암호화 백업은 현재 접속 코드로 잠긴 파일입니다. 일반 JSON은 누구나 읽을 수 있으니 보관에 주의하십시오.', 'An encrypted backup is locked with your current access code. Plain JSON is readable by anyone, so store it carefully.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: exportEnc }, R.T('암호화 백업 내보내기', 'Export encrypted backup')),
        h('button', { class: 'btn', type: 'button', onclick: exportPlain }, R.T('일반 JSON 내보내기', 'Export plain JSON')),
        h('button', { class: 'btn', type: 'button', onclick: importBackup }, R.T('백업 가져오기', 'Import backup')))));

    inner.appendChild(h('p', { class: 'hint' }, 'R.S.S. v' + R.version + R.T(' · 글꼴: Pretendard, D2Coding, Galmuri(접속 코드 숫자) — SIL OFL 1.1', ' · Fonts: Pretendard, D2Coding, Galmuri (access code digits) — SIL OFL 1.1')));
    R.decodeTree(inner, '.stat b, .stat span, .panel h3, .panel p', 45);
  };

  R.actions = { changeCode: changeCode, exportEnc: exportEnc, exportPlain: exportPlain, importBackup: importBackup };

  function stamp() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }

  function changeCode() {
    var cur = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var n1 = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var n2 = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var msg = h('p', { style: { color: 'var(--accent)', minHeight: '22px' } });
    ui.open(R.T('접속 코드 변경', 'Change access code'), [
      h('label', { class: 'field' }, h('span', null, R.T('현재 코드', 'Current code')), cur),
      h('label', { class: 'field' }, h('span', null, R.T('새 코드 (숫자 4~8자리)', 'New code (4–8 digits)')), n1),
      h('label', { class: 'field' }, h('span', null, R.T('새 코드 확인', 'Confirm new code')), n2), msg
    ], [
      { label: R.T('취소', 'Cancel'), cls: 'ghost', run: function (c) { c(); } },
      { label: R.T('변경', 'Change'), cls: 'primary', run: function (c) {
        if (!/^\d{4,8}$/.test(n1.value)) { msg.textContent = R.T('새 코드는 숫자 4~8자리입니다.', 'The new code must be 4–8 digits.'); return false; }
        if (n1.value !== n2.value) { msg.textContent = R.T('새 코드가 서로 다릅니다.', 'The new codes do not match.'); return false; }
        msg.textContent = R.T('확인 중...', 'Checking...');
        R.store.load().then(function (env) { return R.crypto.keyFor(cur.value, env).then(function (k) { return R.crypto.open(k, env); }); })
          .then(function () { return R.store.rekey(n1.value); })
          .then(function () { c(); R.log('SEC', R.T('접속 코드 변경 · 보관소 재암호화', 'Access code changed · vault re-encrypted')); R.toast(R.T('접속 코드를 변경했습니다', 'Access code changed')); }, function () { msg.textContent = R.T('현재 코드가 맞지 않습니다.', 'Current code is wrong.'); });
        return false;
      } }
    ]);
  }

  function exportEnc() {
    R.crypto.seal(R.store.key, db()).then(function (text) { return R.bridge.saveBackup('rss-backup-' + stamp() + '.rssvault', text); })
      .then(function (p) { if (p) { R.log('SEC', R.T('암호화 백업 내보내기', 'Export encrypted backup')); R.toast(R.T('백업 저장 완료', 'Backup saved')); } }, function (e) { R.toast(R.T('실패: ', 'Failed: ') + e.message); });
  }
  function exportPlain() {
    ui.confirm(R.T('일반 JSON 내보내기', 'Export plain JSON'), R.T('암호화되지 않은 파일로 저장합니다. 극비 기록까지 그대로 읽을 수 있습니다.', 'This saves an unencrypted file. Even top secret records will be readable.'), R.T('내보내기', 'Export')).then(function (ok) {
      if (!ok) return;
      R.bridge.saveBackup('rss-export-' + stamp() + '.json', JSON.stringify(db(), null, 2)).then(function (p) { if (p) { R.log('WARN', R.T('비암호화 JSON 내보내기', 'Plain JSON exported')); R.toast(R.T('내보내기 완료', 'Exported')); } });
    });
  }
  function importBackup() {
    R.bridge.openBackup().then(function (text) {
      if (!text) return;
      var obj; try { obj = JSON.parse(text); } catch (e) { R.toast(R.T('읽을 수 없는 파일입니다', 'Unreadable file')); return; }
      var get = obj && obj.ct ? ui.codePrompt(R.T('암호화 백업', 'Encrypted backup'), R.T('이 백업을 만들 때 사용한 접속 코드를 입력하십시오.', 'Enter the access code used when this backup was made.')).then(function (code) {
        if (code == null) return null;
        return R.crypto.keyFor(code, obj).then(function (k) { return R.crypto.open(k, obj); }).catch(function () { throw new Error(R.T('코드가 맞지 않습니다', 'Wrong code')); });
      }) : Promise.resolve(obj);
      get.then(function (data) {
        if (!data) return;
        var norm = R.normalize(data);
        return ui.confirm(R.T('백업 가져오기', 'Import backup'), R.T('시스템 로그 ', 'System log ') + norm.logs.length + R.T('건과 설정을 이 백업으로 교체합니다. (세계관 문서는 앱에 내장되어 있어 바뀌지 않습니다)', ' entries and settings will be replaced. (World documents are built into the app and stay unchanged)'), R.T('교체', 'Replace'), true).then(function (ok) {
          if (!ok) return;
          R.store.db = norm; R.log('SEC', R.T('백업 가져오기 · 로그 ', 'Backup imported · log ') + norm.logs.length + R.T('건', '')); R.logwin.render(); R.go('security'); R.toast(R.T('백업을 불러왔습니다', 'Backup loaded'));
        });
      }).catch(function (e) { R.toast(e.message); });
    });
  }

})();
