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
      h('div', { class: 'dialog-h' }, h('h3', { text: title }), h('button', { class: 'x', type: 'button', 'aria-label': '닫기', onclick: close }, 'X')),
      h('div', { class: 'dialog-b' }, body),
      buttons && buttons.length ? foot : null);
    m.appendChild(dlg);
    m.hidden = false;
    m.onclick = function (e) { if (e.target === m) close(); };
    document.addEventListener('keydown', esc);
    var f = dlg.querySelector('input, textarea, select'); if (f) setTimeout(function () { f.focus(); }, 30);
    return close;
  };
  ui.confirm = function (title, msg, okLabel, danger) {
    return new Promise(function (res) {
      var done = false;
      var close = ui.open(title, h('p', { text: msg }), [
        { label: '취소', cls: 'ghost', run: function (c) { done = true; c(); res(false); } },
        { label: okLabel || '확인', cls: danger ? 'danger' : 'primary', run: function (c) { done = true; c(); res(true); } }
      ]);
      var m = $('#modal'), obs = new MutationObserver(function () { if (m.hidden && !done) { done = true; res(false); obs.disconnect(); } else if (done) obs.disconnect(); });
      obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
      void close;
    });
  };
  ui.codePrompt = function (title, msg) {
    return new Promise(function (res) {
      var inp = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', placeholder: '숫자 4~8자리', autocomplete: 'off' });
      var done = false;
      var ok = function (c) { done = true; c(); res(inp.value); };
      var close = ui.open(title, [h('p', { text: msg }), h('label', { class: 'field' }, h('span', null, 'CODE'), inp)], [
        { label: '취소', cls: 'ghost', run: function (c) { done = true; c(); res(null); } },
        { label: '확인', cls: 'primary', run: ok }
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
  var REL = ['동료', '상관', '부하', '가족', '연인', '적대', '라이벌', '정보원', '감시 대상', '소속', '본거지', '소유', '협력', '거래'];

  /* ───────── 파일 뷰 ───────── */
  var F = { type: 'all', q: '', sel: null, edit: false };
  R.views = {};
  R.views.files = function (root, opts) {
    if (opts && opts.select) { F.sel = opts.select; F.edit = false; F.type = 'all'; F.q = ''; }
    var wrap = h('div', { class: 'files' + (F.sel || F.edit ? ' show-detail' : '') });
    var listPane = h('section', { class: 'list-pane' });
    var detailPane = h('section', { class: 'detail-pane' });
    wrap.appendChild(listPane); wrap.appendChild(detailPane);
    root.appendChild(wrap);

    function counts() {
      var c = { all: db().entities.length };
      R.TYPES.forEach(function (t) { c[t.id] = 0; });
      db().entities.forEach(function (e) { c[e.type]++; });
      return c;
    }
    function filtered() {
      var q = F.q.trim().toLowerCase();
      return db().entities.filter(function (e) {
        if (F.type !== 'all' && e.type !== F.type) return false;
        if (!q) return true;
        return [e.name, e.alias, e.summary, e.body, e.status, R.code(e), e.tags.join(' '), e.fields.map(function (f) { return f.k + ' ' + f.v; }).join(' ')]
          .join(' ').toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return b.updated - a.updated; });
    }

    var search = h('input', { class: 'input', type: 'search', placeholder: '이름 · 코드 · 태그 · 내용 검색', value: F.q });
    var tabs = h('div', { class: 'tabs' });
    var list = h('div', { class: 'list' });
    listPane.appendChild(h('div', { class: 'list-tools' },
      h('div', { class: 'row' }, search, h('button', { class: 'btn primary', type: 'button', onclick: function () { F.sel = null; F.edit = 'new'; draw(); } }, '+ 신규')),
      tabs));
    listPane.appendChild(list);
    search.addEventListener('input', function () { F.q = search.value; drawList(); });

    function drawTabs() {
      var c = counts(); tabs.innerHTML = '';
      [{ id: 'all', name: '전체' }].concat(R.TYPES).forEach(function (t) {
        tabs.appendChild(h('button', { class: 'tab' + (F.type === t.id ? ' on' : ''), type: 'button', onclick: function () { F.type = t.id; drawTabs(); drawList(); } },
          t.name, h('span', { class: 'n' }, c[t.id])));
      });
    }
    function drawList() {
      list.innerHTML = '';
      var items = filtered();
      if (!items.length) {
        var none = h('div', { style: { padding: '16px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' } },
          db().entities.length ? '조건에 맞는 파일이 없습니다.' : '등록된 파일이 없습니다.');
        if (!db().entities.length) none.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { R.sample(); F.sel = db().entities[0].id; draw(); R.toast('예시 기록을 생성했습니다'); } }, '예시 기록 불러오기'));
        list.appendChild(none);
        return;
      }
      items.forEach(function (e) {
        list.appendChild(h('button', { class: 'item' + (F.sel === e.id ? ' on' : ''), type: 'button', onclick: function () { F.sel = e.id; F.edit = false; R.sound.nav(); draw(); } },
          thumb(e),
          h('div', { class: 'item-t' }, e.name),
          h('div', { class: 'item-c' }, clrBadge(e.clearance)),
          h('div', { class: 'item-s' }, R.code(e) + (e.alias ? ' · ' + e.alias : ''))));
      });
    }

    function drawDetail() {
      detailPane.innerHTML = '';
      wrap.classList.toggle('show-detail', !!(F.sel || F.edit));
      var back = h('button', { class: 'btn ghost back', type: 'button', onclick: function () { F.sel = null; F.edit = false; draw(); } }, '< 목록');
      if (F.edit) { detailPane.appendChild(editForm(F.edit === 'new' ? null : byId(F.sel), back)); return; }
      var e = F.sel && byId(F.sel);
      if (!e) {
        F.sel = null;
        var doc = h('div', { class: 'dossier' });
        doc.appendChild(db().entities.length
          ? h('div', { class: 'empty' }, h('h3', null, '파일을 선택하십시오'), h('p', null, '왼쪽 목록에서 열람할 기록을 고르거나 신규 파일을 작성합니다.'))
          : h('div', { class: 'empty' }, h('h3', null, '보관소가 비어 있습니다'),
              h('p', null, '인물 · 조직 · 장소 · 물품 · 세계관 설정을 파일로 등록하고 서로 연결해 관계도와 타임라인을 만듭니다.'),
              h('div', { class: 'row', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
                h('button', { class: 'btn primary', type: 'button', onclick: function () { F.edit = 'new'; draw(); } }, '+ 첫 파일 작성'),
                h('button', { class: 'btn', type: 'button', onclick: function () { R.sample(); F.sel = db().entities[0].id; draw(); R.toast('예시 기록을 생성했습니다'); } }, '예시 기록 불러오기'))));
        detailPane.appendChild(doc);
        return;
      }
      var t = R.type(e.type);
      var doc2 = h('article', { class: 'dossier view-in' });
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
            h('button', { class: 'btn', type: 'button', onclick: function () { F.edit = 'edit'; draw(); } }, '편집'),
            h('button', { class: 'btn', type: 'button', onclick: function () { linkDialog(e, draw); } }, '+ 관계 연결'),
            h('button', { class: 'btn', type: 'button', onclick: function () { R.go('graph', { focus: e.id }); } }, '관계도에서 보기'),
            h('button', { class: 'btn danger', type: 'button', onclick: function () { removeEntity(e); } }, '삭제')))));

      var facts = [];
      if (e.status) facts.push({ k: '상태', v: e.status });
      facts = facts.concat(e.fields);
      if (facts.length) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, 'DATA · 기본 정보')),
          h('div', { class: 'facts' }, facts.map(function (f) { return [h('div', { class: 'k' }, f.k || '-'), h('div', null, f.v)]; }))));
      }
      if (e.body) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, 'RECORD · 기록')), renderBody(e.body)));
      }
      var links = db().links.filter(function (l) { return l.a === e.id || l.b === e.id; });
      doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, 'LINKS · 관계 ' + links.length)),
        links.length ? h('div', { class: 'links' }, links.map(function (l) {
          var o = byId(l.a === e.id ? l.b : l.a); if (!o) return null;
          return h('div', { class: 'link-row' },
            h('button', { class: 'go', type: 'button', onclick: function () { F.sel = o.id; draw(); } },
              h('span', { class: 'ln-rel' }, (l.a === e.id ? '→ ' : '← ') + (l.label || '관계')), h('span', { class: 'ln-name' }, o.name), h('span', { class: 'ln-id' }, R.code(o))),
            h('button', { class: 'x', type: 'button', title: '연결 삭제', 'aria-label': '연결 삭제', onclick: function () {
              db().links = db().links.filter(function (x) { return x.id !== l.id; }); touch(); draw();
            } }, 'X'));
        })) : h('p', { style: { color: 'var(--muted)', margin: 0 } }, '연결된 파일이 없습니다.')));

      var evs = db().events.filter(function (v) { return v.entities.indexOf(e.id) >= 0; }).sort(R.byDate);
      if (evs.length) {
        doc2.appendChild(h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('span', { class: 'label' }, 'EVENTS · 관련 사건 ' + evs.length)),
          h('div', { class: 'links' }, evs.map(function (v) {
            return h('div', { class: 'link-row' }, h('button', { class: 'go', type: 'button', onclick: function () { R.go('timeline', { entity: e.id }); } },
              h('span', { class: 'ln-id', style: { color: 'var(--accent)' } }, v.date || '날짜 미상'), h('span', { class: 'ln-name' }, v.title)), h('span'));
          }))));
      }
      detailPane.appendChild(doc2);
    }

    function removeEntity(e) {
      ui.confirm('파일 삭제', R.code(e) + ' ' + e.name + ' 파일과 연결된 관계를 삭제합니다. 되돌릴 수 없습니다.', '삭제', true).then(function (ok) {
        if (!ok) return;
        var d = db();
        d.entities = d.entities.filter(function (x) { return x.id !== e.id; });
        d.links = d.links.filter(function (l) { return l.a !== e.id && l.b !== e.id; });
        d.events.forEach(function (v) { v.entities = v.entities.filter(function (id) { return id !== e.id; }); });
        F.sel = null; touch(); draw(); R.toast('삭제했습니다');
      });
    }

    function editForm(e, back) {
      var isNew = !e;
      var m = e ? JSON.parse(JSON.stringify(e)) : { type: F.type !== 'all' ? F.type : 'character', name: '', alias: '', clearance: 1, status: '', summary: '', body: '', tags: [], fields: [], image: '' };
      var form = h('form', { class: 'form dossier view-in', onsubmit: function (ev) { ev.preventDefault(); save(); } });
      var sel = function (opts, val) { var s = h('select', { class: 'select' }); opts.forEach(function (o) { var op = h('option', { value: o.v }, o.t); if (String(o.v) === String(val)) op.selected = true; s.appendChild(op); }); return s; };
      var fType = sel(R.TYPES.map(function (t) { return { v: t.id, t: t.code + ' · ' + t.name }; }), m.type);
      var fClr = sel(R.CLEAR.map(function (c) { return { v: c.n, t: c.code + ' · ' + c.name }; }), m.clearance);
      var fName = h('input', { class: 'input', required: true, maxlength: '80', value: m.name, placeholder: '이름 / 명칭' });
      var fAlias = h('input', { class: 'input', maxlength: '80', value: m.alias, placeholder: '코드네임 · 별칭' });
      var dl = h('datalist', { id: 'dl-status' }, R.STATUS.map(function (s) { return h('option', { value: s }); }));
      var fStatus = h('input', { class: 'input', list: 'dl-status', maxlength: '40', value: m.status, placeholder: '예: 활동, 사망, 불명' });
      var fTags = h('input', { class: 'input', value: m.tags.join(', '), placeholder: '쉼표로 구분' });
      var fSum = h('input', { class: 'input', maxlength: '200', value: m.summary, placeholder: '한 줄 요약' });
      var fBody = h('textarea', { class: 'textarea', rows: '12', placeholder: '상세 기록. ||이렇게 감싼 문장||은 검은 막대로 가려집니다.' }, m.body);
      var kvList = h('div', { class: 'kv-list' });
      function kvRow(f) {
        var k = h('input', { class: 'input', placeholder: '항목 (예: 나이)', value: f.k, maxlength: '40' });
        var v = h('input', { class: 'input', placeholder: '값', value: f.v, maxlength: '400' });
        var row = h('div', { class: 'kv' }, k, v, h('button', { class: 'x', type: 'button', 'aria-label': '항목 삭제', onclick: function () { row.remove(); } }, 'X'));
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
      form.appendChild(h('div', { class: 'sec-h' }, h('span', { class: 'label' }, isNew ? 'NEW FILE · 신규 작성' : 'EDIT · ' + R.code(e))));
      form.appendChild(h('div', { class: 'pick-portrait' }, portrait, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        file, h('button', { class: 'btn', type: 'button', onclick: function () { file.click(); } }, '이미지 선택'),
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { m.image = ''; drawPortrait(); } }, '제거'))));
      form.appendChild(h('div', { class: 'grid3' }, h('label', { class: 'field' }, h('span', null, '유형'), fType), h('label', { class: 'field' }, h('span', null, '보안 등급'), fClr), h('label', { class: 'field' }, h('span', null, '상태'), fStatus, dl)));
      form.appendChild(h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, '이름 *'), fName), h('label', { class: 'field' }, h('span', null, '별칭'), fAlias)));
      form.appendChild(h('label', { class: 'field' }, h('span', null, '요약'), fSum));
      form.appendChild(h('label', { class: 'field' }, h('span', null, '태그'), fTags));
      form.appendChild(h('div', { class: 'field' }, h('span', null, '기본 정보 항목'), kvList,
        h('div', null, h('button', { class: 'btn', type: 'button', onclick: function () { kvRow({ k: '', v: '' }); } }, '+ 항목 추가'))));
      form.appendChild(h('label', { class: 'field' }, h('span', null, '기록'), fBody, h('span', { class: 'hint' }, '||문장|| 형식으로 감싸면 열람 전까지 가려집니다.')));
      form.appendChild(h('div', { class: 'form-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: function () { F.edit = false; draw(); } }, '취소'),
        h('button', { class: 'btn primary', type: 'submit' }, isNew ? '등록' : '저장')));

      function save() {
        var name = fName.value.trim(); if (!name) { fName.focus(); return; }
        var out = isNew ? { id: R.uid(), no: ++db().seq, created: Date.now() } : byId(e.id);
        out.type = fType.value; out.clearance = +fClr.value; out.name = name; out.alias = fAlias.value.trim();
        out.status = fStatus.value.trim(); out.summary = fSum.value.trim(); out.body = fBody.value;
        out.tags = fTags.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        out.fields = R.$$('.kv', kvList).map(function (r) { var i = r.querySelectorAll('input'); return { k: i[0].value.trim(), v: i[1].value.trim() }; }).filter(function (f) { return f.k || f.v; });
        out.image = m.image;
        if (isNew) db().entities.push(out);
        touch(out);
        F.sel = out.id; F.edit = false; draw();
        R.toast(isNew ? R.code(out) + ' 등록 완료' : '저장했습니다');
      }
      return form;
    }

    function draw() { drawTabs(); drawList(); drawDetail(); }
    draw();
  };

  /* 관계 연결 대화상자 */
  function linkDialog(e, after) {
    var q = h('input', { class: 'input', type: 'search', placeholder: '대상 검색' });
    var listBox = h('div', { class: 'check-list' });
    var target = null;
    var rel = h('input', { class: 'input', list: 'dl-rel', placeholder: '예: 상관, 적대, 소속', maxlength: '30' });
    var dl = h('datalist', { id: 'dl-rel' }, REL.map(function (r) { return h('option', { value: r }); }));
    var dir = h('select', { class: 'select' }, h('option', { value: 'out' }, e.name + ' → 대상'), h('option', { value: 'in' }, '대상 → ' + e.name));
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
      if (!listBox.children.length) listBox.appendChild(h('span', { class: 'hint' }, '연결할 다른 파일이 없습니다.'));
    }
    q.addEventListener('input', drawList); drawList();
    ui.open('관계 연결 · ' + e.name, [
      h('label', { class: 'field' }, h('span', null, '대상'), q, listBox),
      h('div', { class: 'grid2', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } },
        h('label', { class: 'field' }, h('span', null, '관계'), rel, dl),
        h('label', { class: 'field' }, h('span', null, '방향'), dir))
    ], [
      { label: '취소', cls: 'ghost', run: function (c) { c(); } },
      { label: '연결', cls: 'primary', run: function (c) {
        if (!target) { R.toast('대상을 선택하십시오'); return false; }
        var a = dir.value === 'out' ? e.id : target, b = dir.value === 'out' ? target : e.id;
        db().links.push({ id: R.uid(), a: a, b: b, label: rel.value.trim() });
        touch(); c(); after(); R.toast('관계를 연결했습니다');
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
    var filter = h('select', { class: 'select' }, h('option', { value: '' }, '전체 사건'),
      db().entities.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).map(function (e) {
        var o = h('option', { value: e.id }, R.code(e) + ' · ' + e.name); if (T.entity === e.id) o.selected = true; return o;
      }));
    filter.addEventListener('change', function () { T.entity = filter.value; drawList(); });
    inner.appendChild(h('div', { class: 'tl-tools' }, h('button', { class: 'btn primary', type: 'button', onclick: function () { eventDialog(null, drawList); } }, '+ 사건 추가'), filter,
      h('span', { class: 'hint' }, '날짜는 자유 형식 (예: 2024-03-11, 제국력 312.4) · 숫자 순 정렬')));
    var list = h('div', { class: 'tl-list' }); inner.appendChild(list);
    function drawList() {
      list.innerHTML = ''; list.classList.remove('no-line');
      var evs = db().events.filter(function (v) { return !T.entity || v.entities.indexOf(T.entity) >= 0; }).sort(R.byDate);
      list.style.display = evs.length ? '' : 'block';
      if (!evs.length) {
        list.appendChild(h('div', { class: 'empty' }, h('h3', null, T.entity ? '관련 사건이 없습니다' : '기록된 사건이 없습니다'), h('p', null, '사건을 추가하고 관련 파일을 연결하면 시간순으로 정리됩니다.')));
        list.classList.add('no-line');
        return;
      }
      evs.forEach(function (v) {
        list.appendChild(h('div', { class: 'ev' + (v.major ? ' major' : '') },
          h('div', { class: 'ev-date' }, v.date || '날짜 미상'),
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
    }
    drawList();
    var style = document.createElement('style'); style.textContent = '.tl-list.no-line::before{display:none}'; scroll.appendChild(style);
  };

  function eventDialog(v, after) {
    var isNew = !v;
    var m = v ? JSON.parse(JSON.stringify(v)) : { date: '', title: '', desc: '', major: false, entities: T.entity ? [T.entity] : [] };
    var fDate = h('input', { class: 'input', value: m.date, maxlength: '40', placeholder: '예: 2024-03-11' });
    var fTitle = h('input', { class: 'input', value: m.title, maxlength: '120', placeholder: '사건명' });
    var fDesc = h('textarea', { class: 'textarea', rows: '5', style: { minHeight: '110px' }, placeholder: '개요' }, m.desc);
    var fMajor = h('input', { type: 'checkbox' }); fMajor.checked = m.major;
    var q = h('input', { class: 'input', type: 'search', placeholder: '관련 파일 검색' });
    var chosen = {}; m.entities.forEach(function (id) { chosen[id] = 1; });
    var box = h('div', { class: 'check-list' });
    function drawChecks() {
      box.innerHTML = ''; var s = q.value.trim().toLowerCase();
      db().entities.filter(function (e) { return !s || (e.name + ' ' + e.alias + ' ' + R.code(e)).toLowerCase().indexOf(s) >= 0; }).forEach(function (e) {
        var c = h('input', { type: 'checkbox' }); c.checked = !!chosen[e.id];
        c.addEventListener('change', function () { if (c.checked) chosen[e.id] = 1; else delete chosen[e.id]; });
        box.appendChild(h('label', { class: 'check' }, c, h('span', { style: { color: 'var(--faint)', fontFamily: 'var(--f-mono)', fontSize: '11px' } }, R.code(e)), h('span', null, e.name)));
      });
      if (!box.children.length) box.appendChild(h('span', { class: 'hint' }, '파일이 없습니다.'));
    }
    q.addEventListener('input', drawChecks); drawChecks();
    var btns = [{ label: '취소', cls: 'ghost', run: function (c) { c(); } }];
    if (!isNew) btns.unshift({ label: '삭제', cls: 'danger', run: function (c) {
      c(); ui.confirm('사건 삭제', '"' + v.title + '" 사건을 삭제합니다.', '삭제', true).then(function (ok) {
        if (!ok) return; R.store.db.events = db().events.filter(function (x) { return x.id !== v.id; }); touch(); after();
      });
    } });
    btns.push({ label: isNew ? '추가' : '저장', cls: 'primary', run: function (c) {
      var title = fTitle.value.trim(); if (!title) { fTitle.focus(); return false; }
      var out = isNew ? { id: R.uid() } : db().events.find(function (x) { return x.id === v.id; });
      out.date = fDate.value.trim(); out.title = title; out.desc = fDesc.value.trim(); out.major = fMajor.checked;
      out.entities = db().entities.filter(function (e) { return chosen[e.id]; }).map(function (e) { return e.id; });
      if (isNew) db().events.push(out);
      touch(); c(); after();
    } });
    ui.open(isNew ? '사건 추가' : '사건 편집', [
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '16px' } },
        h('label', { class: 'field' }, h('span', null, '날짜'), fDate), h('label', { class: 'field' }, h('span', null, '사건명 *'), fTitle)),
      h('label', { class: 'field' }, h('span', null, '개요'), fDesc),
      h('label', { class: 'check' }, fMajor, h('span', null, '주요 사건으로 표시')),
      h('div', { class: 'field' }, h('span', null, '관련 파일'), q, box)
    ], btns, true);
  }

  /* ───────── 보안 · 백업 ───────── */
  R.views.security = function (root) {
    var d = db();
    var scroll = h('div', { class: 'sec-view' }), inner = h('div', { class: 'sec-inner view-in' });
    scroll.appendChild(inner); root.appendChild(scroll);
    inner.appendChild(h('div', { class: 'stat' },
      [['파일', d.entities.length], ['관계', d.links.length], ['사건', d.events.length], ['극비', d.entities.filter(function (e) { return e.clearance === 3; }).length]]
        .map(function (s) { return h('div', null, h('b', null, s[1]), h('span', null, s[0])); })));

    var auto = h('select', { class: 'select', style: { width: 'auto', minWidth: '160px' } },
      [[0, '사용 안 함'], [3, '3분'], [5, '5분'], [10, '10분'], [30, '30분']].map(function (o) {
        var op = h('option', { value: o[0] }, o[1]); if (d.settings.autoLock === o[0]) op.selected = true; return op;
      }));
    auto.addEventListener('change', function () { d.settings.autoLock = +auto.value; touch(); R.resetIdle(); R.toast('자동 잠금: ' + auto.selectedOptions[0].textContent); });

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, '접속 코드'),
      h('p', null, '모든 기록은 접속 코드로 암호화(AES-256-GCM)되어 이 PC에만 저장됩니다. 코드를 잊으면 복구할 수 없습니다.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: changeCode }, '코드 변경'),
        h('span', { class: 'label', style: { marginLeft: '8px' } }, '자동 잠금'), auto)));

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, '백업'),
      h('p', null, '암호화 백업은 현재 접속 코드로 잠긴 파일입니다. 일반 JSON은 누구나 읽을 수 있으니 보관에 주의하십시오.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: exportEnc }, '암호화 백업 내보내기'),
        h('button', { class: 'btn', type: 'button', onclick: exportPlain }, '일반 JSON 내보내기'),
        h('button', { class: 'btn', type: 'button', onclick: importBackup }, '백업 가져오기'))));

    inner.appendChild(h('section', { class: 'panel' }, h('h3', null, '보관소'),
      h('p', null, '예시 기록을 추가하거나 모든 기록을 삭제합니다.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: function () { R.sample(); R.go('security'); R.toast('예시 기록을 추가했습니다'); } }, '예시 기록 추가'),
        h('button', { class: 'btn danger', type: 'button', onclick: wipe }, '모든 기록 삭제'))));

    inner.appendChild(h('p', { class: 'hint' }, 'R.S.S. v' + (R.version || '1.0.0') + ' · 글꼴: Galmuri (SIL OFL 1.1)'));
  };

  function stamp() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }

  function changeCode() {
    var cur = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var n1 = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var n2 = h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' });
    var msg = h('p', { style: { color: 'var(--accent)', minHeight: '22px' } });
    ui.open('접속 코드 변경', [
      h('label', { class: 'field' }, h('span', null, '현재 코드'), cur),
      h('label', { class: 'field' }, h('span', null, '새 코드 (숫자 4~8자리)'), n1),
      h('label', { class: 'field' }, h('span', null, '새 코드 확인'), n2), msg
    ], [
      { label: '취소', cls: 'ghost', run: function (c) { c(); } },
      { label: '변경', cls: 'primary', run: function (c) {
        if (!/^\d{4,8}$/.test(n1.value)) { msg.textContent = '새 코드는 숫자 4~8자리입니다.'; return false; }
        if (n1.value !== n2.value) { msg.textContent = '새 코드가 서로 다릅니다.'; return false; }
        msg.textContent = '확인 중...';
        R.store.load().then(function (env) { return R.crypto.keyFor(cur.value, env).then(function (k) { return R.crypto.open(k, env); }); })
          .then(function () { return R.store.rekey(n1.value); })
          .then(function () { c(); R.toast('접속 코드를 변경했습니다'); }, function () { msg.textContent = '현재 코드가 맞지 않습니다.'; });
        return false;
      } }
    ]);
  }

  function exportEnc() {
    R.crypto.seal(R.store.key, db()).then(function (text) { return R.bridge.saveBackup('rss-backup-' + stamp() + '.rssvault', text); })
      .then(function (p) { if (p) R.toast('백업 저장 완료'); }, function (e) { R.toast('실패: ' + e.message); });
  }
  function exportPlain() {
    ui.confirm('일반 JSON 내보내기', '암호화되지 않은 파일로 저장합니다. 극비 기록까지 그대로 읽을 수 있습니다.', '내보내기').then(function (ok) {
      if (!ok) return;
      R.bridge.saveBackup('rss-export-' + stamp() + '.json', JSON.stringify(db(), null, 2)).then(function (p) { if (p) R.toast('내보내기 완료'); });
    });
  }
  function importBackup() {
    R.bridge.openBackup().then(function (text) {
      if (!text) return;
      var obj; try { obj = JSON.parse(text); } catch (e) { R.toast('읽을 수 없는 파일입니다'); return; }
      var get = obj && obj.ct ? ui.codePrompt('암호화 백업', '이 백업을 만들 때 사용한 접속 코드를 입력하십시오.').then(function (code) {
        if (code == null) return null;
        return R.crypto.keyFor(code, obj).then(function (k) { return R.crypto.open(k, obj); }).catch(function () { throw new Error('코드가 맞지 않습니다'); });
      }) : Promise.resolve(obj);
      get.then(function (data) {
        if (!data) return;
        var norm = R.normalize(data);
        return ui.confirm('백업 가져오기', '파일 ' + norm.entities.length + ' · 관계 ' + norm.links.length + ' · 사건 ' + norm.events.length + '건. 현재 기록을 이 백업으로 교체합니다.', '교체', true).then(function (ok) {
          if (!ok) return;
          R.store.db = norm; R.store.save(); R.go('files'); R.toast('백업을 불러왔습니다');
        });
      }).catch(function (e) { R.toast(e.message); });
    });
  }
  function wipe() {
    ui.confirm('모든 기록 삭제', '파일 · 관계 · 사건이 모두 삭제됩니다. 접속 코드는 유지됩니다.', '삭제', true).then(function (ok) {
      if (!ok) return;
      var s = db().settings; R.store.db = R.emptyDB(); R.store.db.settings = s; R.store.save(); R.go('security'); R.toast('삭제했습니다');
    });
  }

  /* 예시 기록 (가상의 인물·조직) */
  R.sample = function () {
    var d = db(), mk = function (o) { var e = Object.assign({ id: R.uid(), no: ++d.seq, alias: '', status: '', summary: '', body: '', tags: [], fields: [], image: '', created: Date.now(), updated: Date.now() }, o); d.entities.push(e); return e; };
    var a = mk({ type: 'character', name: '한서윤', alias: 'KESTREL', clearance: 2, status: '활동', summary: '북부 지부 현장 요원. 장거리 감시 전문.', tags: ['현장', '북부'],
      fields: [{ k: '나이', v: '31' }, { k: '소속', v: '북부 지부 제3과' }, { k: '특기', v: '장거리 감시, 암호 해독' }],
      body: '입국 기록상 3월 11일 귀환. 이후 ||항만 창고에서 미확인 인물과 접촉||한 정황이 있음.\n\n상세 동선은 관련 사건 참조.' });
    var b = mk({ type: 'organization', name: '북부 지부', alias: 'NORTH DESK', clearance: 1, status: '해당 없음', summary: '국경 지역 정보 수집을 담당하는 지부.', tags: ['지부'] });
    var c = mk({ type: 'character', name: '미상의 접촉자', alias: 'GREY', clearance: 3, status: '불명', summary: '신원 미확인. 항만 지역에서 반복 목격.', tags: ['추적'],
      body: '확보된 사진 없음. ||외투 왼쪽 소매에 붉은 실 표식||.' });
    var dPl = mk({ type: 'location', name: '항만 7번 창고', clearance: 1, status: '해당 없음', summary: '접촉이 이루어진 장소.', fields: [{ k: '위치', v: '남측 부두' }] });
    var e = mk({ type: 'lore', name: '보안 등급 체계', clearance: 0, summary: '공개 · 대외비 · 기밀 · 극비 4단계.', body: '등급이 높을수록 열람 가능한 인원이 줄어든다. 극비 문서는 원본 반출이 금지된다.' });
    d.links.push({ id: R.uid(), a: a.id, b: b.id, label: '소속' }, { id: R.uid(), a: a.id, b: c.id, label: '감시 대상' }, { id: R.uid(), a: c.id, b: dPl.id, label: '출몰' }, { id: R.uid(), a: b.id, b: dPl.id, label: '관할' });
    d.events.push({ id: R.uid(), date: '2024-03-11', title: 'KESTREL 귀환', desc: '북부 국경 검문소 통과.', major: false, entities: [a.id] },
      { id: R.uid(), date: '2024-03-14', title: '항만 7번 창고 접촉', desc: '미확인 인물과 약 4분간 접촉.', major: true, entities: [a.id, c.id, dPl.id] },
      { id: R.uid(), date: '2024-03-20', title: '북부 지부 감시 작전 승인', desc: '', major: false, entities: [b.id, c.id] });
    void e; touch();
  };
})();
