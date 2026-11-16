/* 화면: 공용 모달, 파일(인물·세계관 데이터), 타임라인, 보안·백업 */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var db = function () { return R.store.db; };
  var byId = function (id) { return db().entities.find(function (e) { return e.id === id; }); };
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
    if (opts && opts.select) { F.sel = opts.select; F.edit = opts.edit ? 'edit' : false; F.type = 'all'; F.q = ''; }
    if (opts && opts.create) { F.sel = null; F.edit = 'new'; F.type = opts.create; F.q = ''; }
    var wrap = h('div', { class: 'files' + (F.sel || F.edit ? ' show-detail' : '') });
    var listPane = h('section', { class: 'list-pane' });
    var detailPane = h('section', { class: 'detail-pane' });
    wrap.appendChild(listPane); wrap.appendChild(detailPane);
    root.appendChild(wrap);

    function counts() {
      var c = { all: db().entities.length + R.SEALED.length };
      R.TYPES.forEach(function (t) { c[t.id] = 0; });
      db().entities.concat(R.SEALED).forEach(function (e) { c[e.type]++; });
      return c;
    }
    function filtered() {
      var q = F.q.trim().toLowerCase();
      var own = db().entities.filter(function (e) {
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
      h('div', { class: 'row' }, search, h('button', { class: 'btn primary', type: 'button', onclick: function () { F.sel = null; F.edit = 'new'; draw(); } }, R.T('+ 신규', '+ New'))),
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
      if (F.edit) { detailPane.appendChild(editForm(F.edit === 'new' ? null : byId(F.sel), back)); return; }
      var sealed = F.sel && R.SEALED.find(function (s) { return s.id === F.sel; });
      if (sealed) { var dv = deniedView(sealed); detailPane.appendChild(dv); R.decodeTree(dv, '.deny-code, .deny-ko, .facts > div', 45); return; }
      var e = F.sel && byId(F.sel);
      if (!e) {
        F.sel = null;
        var doc = h('div', { class: 'dossier' });
        doc.appendChild(db().entities.length
          ? h('div', { class: 'empty' }, h('h3', null, R.T('문서를 선택하십시오', 'Select a document')), h('p', null, R.T('왼쪽 목록에서 열람할 문서를 고르거나 신규 문서를 작성합니다.', 'Pick a document from the list, or write a new one.')))
          : h('div', { class: 'empty' }, h('h3', null, R.T('아카이브가 비어 있습니다', 'The archive is empty')),
              h('p', null, R.T('인물 · 조직 · 장소 · 물품 · 세계관 문서를 등록하고 서로 연결합니다. 대화창에서 Control 에게 문서 작성을 요청해도 됩니다.', 'File character, organization, location, item and lore documents and link them together. You can also ask Control to write one.')),
              h('button', { class: 'btn primary', type: 'button', onclick: function () { F.edit = 'new'; draw(); } }, R.T('+ 첫 문서 작성', '+ Write the first document'))));
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
            h('button', { class: 'btn', type: 'button', onclick: function () { F.edit = 'edit'; draw(); } }, R.T('편집', 'Edit')),
            h('button', { class: 'btn', type: 'button', onclick: function () { linkDialog(e, draw); } }, R.T('+ 관계 연결', '+ Link')),
            h('button', { class: 'btn', type: 'button', onclick: function () { R.go('graph', { focus: e.id }); } }, R.T('관계도에서 보기', 'Show in graph')),
            h('button', { class: 'btn danger', type: 'button', onclick: function () { removeEntity(e); } }, R.T('삭제', 'Delete'))))));

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
      var links = db().links.filter(function (l) { return l.a === e.id || l.b === e.id; });
      doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, R.T('LINKS · 관계 ', 'LINKS · ') + links.length)),
        links.length ? h('div', { class: 'links' }, links.map(function (l) {
          var o = byId(l.a === e.id ? l.b : l.a); if (!o) return null;
          return h('div', { class: 'link-row' },
            h('button', { class: 'go', type: 'button', onclick: function () { F.sel = o.id; draw(); } },
              h('span', { class: 'ln-rel' }, (l.a === e.id ? '→ ' : '← ') + (l.label || R.T('관계', 'link'))), h('span', { class: 'ln-name' }, o.name), h('span', { class: 'ln-id' }, R.code(o))),
            h('button', { class: 'x', type: 'button', title: R.T('연결 삭제', 'Remove link'), 'aria-label': R.T('연결 삭제', 'Remove link'), onclick: function () {
              db().links = db().links.filter(function (x) { return x.id !== l.id; }); R.log('DATA', R.T('관계 해제 ', 'Unlinked ') + R.code(e) + ' — ' + R.code(o)); touch(); draw();
            } }, 'X'));
        })) : h('p', { style: { color: 'var(--muted)', margin: 0 } }, R.T('연결된 파일이 없습니다.', 'No linked documents.'))));

      var evs = db().events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
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

    function removeEntity(e) {
      ui.confirm(R.T('파일 삭제', 'Delete document'), R.code(e) + ' ' + e.name + R.T(' 파일과 연결된 관계를 삭제합니다. 되돌릴 수 없습니다.', ' and its links will be deleted. This cannot be undone.'), R.T('삭제', 'Delete'), true).then(function (ok) {
        if (!ok) return;
        var d = db();
        d.entities = d.entities.filter(function (x) { return x.id !== e.id; });
        d.links = d.links.filter(function (l) { return l.a !== e.id && l.b !== e.id; });
        d.events.forEach(function (v) { v.entities = v.entities.filter(function (id) { return id !== e.id; }); });
        R.log('DATA', R.T('파일 삭제 ', 'Deleted ') + R.code(e) + ' ' + e.name); F.sel = null; touch(); draw(); R.toast(R.T('삭제했습니다', 'Deleted'));
      });
    }

    function editForm(e, back) {
      var isNew = !e;
      var m = e ? JSON.parse(JSON.stringify(e)) : { type: F.type !== 'all' ? F.type : 'character', name: '', alias: '', clearance: 1, status: '', summary: '', body: '', tags: [], fields: [], image: '' };
      var form = h('form', { class: 'form dossier view-in', onsubmit: function (ev) { ev.preventDefault(); save(); } });
      var sel = function (opts, val) { var s = h('select', { class: 'select' }); opts.forEach(function (o) { var op = h('option', { value: o.v }, o.t); if (String(o.v) === String(val)) op.selected = true; s.appendChild(op); }); return s; };
      var fType = sel(R.TYPES.map(function (t) { return { v: t.id, t: t.code + ' · ' + t.name }; }), m.type);
      var fClr = sel(R.CLEAR.map(function (c) { return { v: c.n, t: c.code + ' · ' + c.name }; }), m.clearance);
      var fName = h('input', { class: 'input', required: true, maxlength: '80', value: m.name, placeholder: R.T('이름 / 명칭', 'Name') });
      var fAlias = h('input', { class: 'input', maxlength: '80', value: m.alias, placeholder: R.T('코드네임 · 별칭', 'Codename · alias') });
      var dl = h('datalist', { id: 'dl-status' }, R.STATUS.map(function (s) { return h('option', { value: s }); }));
      var fStatus = h('input', { class: 'input', list: 'dl-status', maxlength: '40', value: m.status, placeholder: R.T('예: 활동, 사망, 불명', 'e.g. active, deceased, unknown') });
      var fTags = h('input', { class: 'input', value: m.tags.join(', '), placeholder: R.T('쉼표로 구분', 'comma separated') });
      var fSum = h('input', { class: 'input', maxlength: '200', value: m.summary, placeholder: R.T('한 줄 요약', 'One-line summary') });
      var fBody = h('textarea', { class: 'textarea', rows: '12', placeholder: R.T('상세 기록. ||이렇게 감싼 문장||은 검은 막대로 가려집니다.', 'Details. ||Text wrapped like this|| is blacked out.') }, m.body);
      var kvList = h('div', { class: 'kv-list' });
      function kvRow(f) {
        var k = h('input', { class: 'input', placeholder: R.T('항목 (예: 나이)', 'Field (e.g. age)'), value: f.k, maxlength: '40' });
        var v = h('input', { class: 'input', placeholder: R.T('값', 'Value'), value: f.v, maxlength: '400' });
        var row = h('div', { class: 'kv' }, k, v, h('button', { class: 'x', type: 'button', 'aria-label': R.T('항목 삭제', 'Remove field'), onclick: function () { row.remove(); } }, 'X'));
        kvList.appendChild(row);
      }
      m.fields.forEach(kvRow);
      var portrait = h('div', { class: 'portrait' });
      var drawPortrait = function () { portrait.innerHTML = ''; if (m.image) portrait.appendChild(h('img', { src: m.image, alt: '' })); else portrait.textContent = 'NO IMAGE'; };
      drawPortrait();
      var file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function () {
        if (!file.files[0]) return;
        R.shrinkImage(file.files[0]).then(function (url) { m.image = url; drawPortrait(); }, function (err) { R.toast(err.message); });
      } });

      form.appendChild(back);
      form.appendChild(h('div', { class: 'sec-h' }, h('span', { class: 'label' }, isNew ? R.T('NEW FILE · 신규 작성', 'NEW FILE') : 'EDIT · ' + R.code(e))));
      form.appendChild(h('div', { class: 'pick-portrait' }, portrait, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        file, h('button', { class: 'btn', type: 'button', onclick: function () { file.click(); } }, R.T('이미지 선택', 'Choose image')),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { m.image = ''; drawPortrait(); } }, R.T('제거', 'Remove')))));
      form.appendChild(h('div', { class: 'grid3' }, h('label', { class: 'field' }, h('span', null, R.T('유형', 'Type')), fType), h('label', { class: 'field' }, h('span', null, R.T('보안 등급', 'Clearance')), fClr), h('label', { class: 'field' }, h('span', null, R.T('상태', 'Status')), fStatus, dl)));
      form.appendChild(h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, R.T('이름 *', 'Name *')), fName), h('label', { class: 'field' }, h('span', null, R.T('별칭', 'Alias')), fAlias)));
      form.appendChild(h('label', { class: 'field' }, h('span', null, R.T('요약', 'Summary')), fSum));
      form.appendChild(h('label', { class: 'field' }, h('span', null, R.T('태그', 'Tags')), fTags));
      form.appendChild(h('div', { class: 'field' }, h('span', null, R.T('기본 정보 항목', 'Fields')), kvList,
        h('div', null, h('button', { class: 'btn', type: 'button', onclick: function () { kvRow({ k: '', v: '' }); } }, R.T('+ 항목 추가', '+ Add field')))));
      form.appendChild(h('label', { class: 'field' }, h('span', null, R.T('기록', 'Record')), fBody, h('span', { class: 'hint' }, R.T('||문장|| 형식으로 감싸면 열람 전까지 가려집니다.', 'Wrap text in ||like this|| to black it out until clicked.'))));
      form.appendChild(h('div', { class: 'form-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { F.edit = false; draw(); } }, R.T('취소', 'Cancel')),
        h('button', { class: 'btn primary', type: 'submit' }, isNew ? R.T('등록', 'File') : R.T('저장', 'Save'))));

      function save() {
        var name = fName.value.trim(); if (!name) { fName.focus(); return; }
        var out = isNew ? { id: R.uid(), no: ++db().seq, created: Date.now() } : byId(e.id);
        out.type = fType.value; out.clearance = +fClr.value; out.name = name; out.alias = fAlias.value.trim();
        out.status = fStatus.value.trim(); out.summary = fSum.value.trim(); out.body = fBody.value;
        out.tags = fTags.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        out.fields = R.$$('.kv', kvList).map(function (r) { var i = r.querySelectorAll('input'); return { k: i[0].value.trim(), v: i[1].value.trim() }; }).filter(function (f) { return f.k || f.v; });
        out.image = m.image;
        if (isNew) db().entities.push(out);
        R.log('DATA', (isNew ? R.T('파일 등록 ', 'Filed ') : R.T('파일 수정 ', 'Updated ')) + R.code(out) + ' ' + out.name);
        touch(out);
        F.sel = out.id; F.edit = false; draw();
        R.toast(isNew ? R.code(out) + R.T(' 등록 완료', ' filed') : R.T('저장했습니다', 'Saved'));
      }
      return form;
    }

    function draw() { drawTabs(); drawList(); drawDetail(); }
    R.decodeTree(listPane, '.item-t, .item-s', 40);
    draw();
  };

  /* 관계 연결 대화상자 */
  function linkDialog(e, after) {
    var q = h('input', { class: 'input', type: 'search', placeholder: R.T('대상 검색', 'Search target') });
    var listBox = h('div', { class: 'check-list' });
    var target = null;
    var rel = h('input', { class: 'input', list: 'dl-rel', placeholder: R.T('예: 상관, 적대, 소속', 'e.g. superior, hostile, member of'), maxlength: '30' });
    var dl = h('datalist', { id: 'dl-rel' }, REL.map(function (r) { return h('option', { value: r }); }));
    var dir = h('select', { class: 'select' }, h('option', { value: 'out' }, e.name + R.T(' → 대상', ' → target')), h('option', { value: 'in' }, R.T('대상 → ', 'target → ') + e.name));
    function drawList() {
      listBox.innerHTML = '';
      var s = q.value.trim().toLowerCase();
      db().entities.filter(function (x) { return x.id !== e.id && (!s || (x.name + ' ' + x.alias + ' ' + R.code(x)).toLowerCase().indexOf(s) >= 0); })
        .forEach(function (x) {
          var r = h('input', { type: 'radio', name: 'lt', value: x.id });
          if (target === x.id) r.checked = true;
          r.addEventListener('change', function () { target = x.id; });
          listBox.appendChild(h('label', { class: 'check' }, r, h('span', { style: { color: 'var(--faint)', fontFamily: 'var(--f-mono)', fontSize: '11px' } }, R.code(x)), h('span', null, x.name)));
        });
      if (!listBox.children.length) listBox.appendChild(h('span', { class: 'hint' }, R.T('연결할 다른 파일이 없습니다.', 'No other documents to link.')));
    }
    q.addEventListener('input', drawList); drawList();
    ui.open(R.T('관계 연결 · ', 'Link · ') + e.name, [
      h('label', { class: 'field' }, h('span', null, R.T('대상', 'Target')), q, listBox),
      h('div', { class: 'grid2', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
        h('label', { class: 'field' }, h('span', null, R.T('관계', 'link')), rel, dl),
        h('label', { class: 'field' }, h('span', null, R.T('방향', 'Direction')), dir))
    ], [
      { label: R.T('취소', 'Cancel'), cls: 'ghost', run: function (c) { c(); } },
      { label: R.T('연결', 'Link'), cls: 'primary', run: function (c) {
        if (!target) { R.toast(R.T('대상을 선택하십시오', 'Select a target')); return false; }
        var a = dir.value === 'out' ? e.id : target, b = dir.value === 'out' ? target : e.id;
        db().links.push({ id: R.uid(), a: a, b: b, label: rel.value.trim() });
        R.log('DATA', R.T('관계 연결 ', 'Linked ') + R.code(byId(a)) + ' → ' + R.code(byId(b)) + (rel.value.trim() ? ' [' + rel.value.trim() + ']' : ''));
        touch(); c(); after(); R.toast(R.T('관계를 연결했습니다', 'Linked'));
      } }
    ]);
  }

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
      db().entities.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).map(function (e) {
        var o = h('option', { value: e.id }, R.code(e) + ' · ' + e.name); if (T.entity === e.id) o.selected = true; return o;
      }));
    filter.addEventListener('change', function () { T.entity = filter.value; drawList(); });
    inner.appendChild(h('div', { class: 'tl-tools' }, h('button', { class: 'btn primary', type: 'button', onclick: function () { eventDialog(null, drawList); } }, R.T('+ 사건 추가', '+ Add event')), filter,
      h('span', { class: 'hint' }, R.T('날짜는 자유 형식 (예: 2024-03-11, 제국력 312.4) · 숫자 순 정렬', 'Free-form dates (e.g. 2024-03-11, Year 312.4) · sorted numerically'))));
    var list = h('div', { class: 'tl-list' }); inner.appendChild(list);
    function drawList() {
      list.innerHTML = ''; list.classList.remove('no-line');
      var evs = db().events.filter(function (v) { return !T.entity || v.entities.indexOf(T.entity) >= 0; }).sort(R.byDate);
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
          h('div', { class: 'ev-card', role: 'button', tabindex: '0', onclick: function (ev) { if (ev.target.closest('.ev-ent')) return; eventDialog(v, drawList); },
            onkeydown: function (ev) { if (ev.key === 'Enter') eventDialog(v, drawList); } },
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

  function eventDialog(v, after) {
    var isNew = !v;
    var m = v ? JSON.parse(JSON.stringify(v)) : { date: '', title: '', desc: '', major: false, entities: T.entity ? [T.entity] : [] };
    var fDate = h('input', { class: 'input', value: m.date, maxlength: '40', placeholder: R.T('예: 2024-03-11', 'e.g. 2024-03-11') });
    var fTitle = h('input', { class: 'input', value: m.title, maxlength: '120', placeholder: R.T('사건명', 'Title') });
    var fDesc = h('textarea', { class: 'textarea', rows: '5', style: { minHeight: '110px' }, placeholder: R.T('개요', 'Summary') }, m.desc);
    var fMajor = h('input', { type: 'checkbox' }); fMajor.checked = m.major;
    var q = h('input', { class: 'input', type: 'search', placeholder: R.T('관련 파일 검색', 'Search related documents') });
    var chosen = {}; m.entities.forEach(function (id) { chosen[id] = 1; });
    var box = h('div', { class: 'check-list' });
    function drawChecks() {
      box.innerHTML = ''; var s = q.value.trim().toLowerCase();
      db().entities.filter(function (e) { return !s || (e.name + ' ' + e.alias + ' ' + R.code(e)).toLowerCase().indexOf(s) >= 0; }).forEach(function (e) {
        var c = h('input', { type: 'checkbox' }); c.checked = !!chosen[e.id];
        c.addEventListener('change', function () { if (c.checked) chosen[e.id] = 1; else delete chosen[e.id]; });
        box.appendChild(h('label', { class: 'check' }, c, h('span', { style: { color: 'var(--faint)', fontFamily: 'var(--f-mono)', fontSize: '11px' } }, R.code(e)), h('span', null, e.name)));
      });
      if (!box.children.length) box.appendChild(h('span', { class: 'hint' }, R.T('파일이 없습니다.', 'No documents.')));
    }
    q.addEventListener('input', drawChecks); drawChecks();
    var btns = [{ label: R.T('취소', 'Cancel'), cls: 'ghost', run: function (c) { c(); } }];
    if (!isNew) btns.unshift({ label: R.T('삭제', 'Delete'), cls: 'danger', run: function (c) {
      c(); ui.confirm(R.T('사건 삭제', 'Delete event'), '"' + v.title + R.T('" 사건을 삭제합니다.', '" will be deleted.'), R.T('삭제', 'Delete'), true).then(function (ok) {
        if (!ok) return; R.store.db.events = db().events.filter(function (x) { return x.id !== v.id; }); R.log('DATA', R.T('사건 삭제 ', 'Event deleted ') + v.title); touch(); after();
      });
    } });
    btns.push({ label: isNew ? R.T('추가', 'Add') : R.T('저장', 'Save'), cls: 'primary', run: function (c) {
      var title = fTitle.value.trim(); if (!title) { fTitle.focus(); return false; }
      var out = isNew ? { id: R.uid() } : db().events.find(function (x) { return x.id === v.id; });
      out.date = fDate.value.trim(); out.title = title; out.desc = fDesc.value.trim(); out.major = fMajor.checked;
      out.entities = db().entities.filter(function (e) { return chosen[e.id]; }).map(function (e) { return e.id; });
      if (isNew) db().events.push(out);
      R.log('DATA', (isNew ? R.T('사건 기록 ', 'Event logged ') : R.T('사건 수정 ', 'Event updated ')) + (out.date ? out.date + ' ' : '') + out.title);
      touch(); c(); after();
    } });
    ui.open(isNew ? R.T('사건 추가', 'Add event') : R.T('사건 편집', 'Edit event'), [
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '16px' } },
        h('label', { class: 'field' }, h('span', null, R.T('날짜', 'Date')), fDate), h('label', { class: 'field' }, h('span', null, R.T('사건명 *', 'Title *')), fTitle)),
      h('label', { class: 'field' }, h('span', null, R.T('개요', 'Summary')), fDesc),
      h('label', { class: 'check' }, fMajor, h('span', null, R.T('주요 사건으로 표시', 'Mark as major event'))),
      h('div', { class: 'field' }, h('span', null, R.T('관련 파일', 'Related documents')), q, box)
    ], btns, true);
  }

  /* ───────── 보안 · 백업 ───────── */
  R.views.security = function (root) {
    var d = db();
    var scroll = h('div', { class: 'sec-view' }), inner = h('div', { class: 'sec-inner view-in' });
    scroll.appendChild(inner); root.appendChild(scroll);
    inner.appendChild(h('div', { class: 'stat' },
      [[R.T('파일', 'Documents'), d.entities.length], [R.T('관계', 'link'), d.links.length], [R.T('사건', 'Events'), d.events.length], [R.T('극비', 'Top secret'), d.entities.filter(function (e) { return e.clearance === 3; }).length]]
        .map(function (s) { return h('div', null, h('b', null, s[1]), h('span', null, s[0])); })));

    var auto = h('select', { class: 'select', style: { width: 'auto', minWidth: '160px' } },
      [[0, R.T('사용 안 함', 'Off')], [3, R.T('3분', '3 min')], [5, R.T('5분', '5 min')], [10, R.T('10분', '10 min')], [30, R.T('30분', '30 min')]].map(function (o) {
        var op = h('option', { value: o[0] }, o[1]); if (d.settings.autoLock === o[0]) op.selected = true; return op;
      }));
    auto.addEventListener('change', function () { d.settings.autoLock = +auto.value; R.log('SEC', R.T('자동 잠금 설정: ', 'Auto lock: ') + auto.selectedOptions[0].textContent); touch(); R.resetIdle(); R.toast(R.T('자동 잠금: ', 'Auto lock: ') + auto.selectedOptions[0].textContent); });

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, R.T('접속 코드', 'Access code')),
      h('p', null, R.T('모든 기록은 접속 코드로 암호화(AES-256-GCM)되어 이 PC에만 저장됩니다. 코드를 잊으면 복구할 수 없습니다.', 'All records are encrypted with your access code (AES-256-GCM) and stored only on this PC. A forgotten code cannot be recovered.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: changeCode }, R.T('코드 변경', 'Change code')),
        h('span', { class: 'label', style: { marginLeft: '8px' } }, R.T('자동 잠금', 'Auto lock')), auto)));

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, R.T('백업', 'Backup')),
      h('p', null, R.T('암호화 백업은 현재 접속 코드로 잠긴 파일입니다. 일반 JSON은 누구나 읽을 수 있으니 보관에 주의하십시오.', 'An encrypted backup is locked with your current access code. Plain JSON is readable by anyone, so store it carefully.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: exportEnc }, R.T('암호화 백업 내보내기', 'Export encrypted backup')),
        h('button', { class: 'btn', type: 'button', onclick: exportPlain }, R.T('일반 JSON 내보내기', 'Export plain JSON')),
        h('button', { class: 'btn', type: 'button', onclick: importBackup }, R.T('백업 가져오기', 'Import backup')))));

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, R.T('보관소', 'Vault')),
      h('p', null, R.T('아카이브의 모든 문서 · 관계 · 사건을 삭제합니다. 봉인 문서와 접속 코드는 유지됩니다.', 'Deletes every document, link and event in the archive. Sealed documents and the access code are kept.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn danger', type: 'button', onclick: wipe }, R.T('모든 기록 삭제', 'Delete all records')))));

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
        return ui.confirm(R.T('백업 가져오기', 'Import backup'), R.T('파일 ', 'Documents ') + norm.entities.length + R.T(' · 관계 ', ' · links ') + norm.links.length + R.T(' · 사건 ', ' · events ') + norm.events.length + R.T('건. 현재 기록을 이 백업으로 교체합니다.', '. The current records will be replaced by this backup.'), R.T('교체', 'Replace'), true).then(function (ok) {
          if (!ok) return;
          norm.logs = db().logs; R.store.db = norm; R.log('SEC', R.T('백업 가져오기 · 파일 ', 'Backup imported · documents ') + norm.entities.length + R.T('건', '')); R.go('files'); R.toast(R.T('백업을 불러왔습니다', 'Backup loaded'));
        });
      }).catch(function (e) { R.toast(e.message); });
    });
  }
  function wipe() {
    ui.confirm(R.T('모든 기록 삭제', 'Delete all records'), R.T('파일 · 관계 · 사건이 모두 삭제됩니다. 접속 코드는 유지됩니다.', 'All documents, links and events will be deleted. The access code is kept.'), R.T('삭제', 'Delete'), true).then(function (ok) {
      if (!ok) return;
      var s = db().settings, lg = db().logs; R.store.db = R.emptyDB(); R.store.db.settings = s; R.store.db.logs = lg; R.log('WARN', R.T('모든 기록 삭제', 'Delete all records')); R.go('security'); R.toast(R.T('삭제했습니다', 'Deleted'));
    });
  }
})();
