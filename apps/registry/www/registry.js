/* Leviathan Registry: 인물 등록 신청서를 쓰고 R.S.S. 에 제출
   - 쓰는 중인 내용은 이 기기에 자동 저장 (앱을 꺼도 이어서 쓸 수 있음)
   - 제출: 익명 로그인(기기마다 하나) → Firestore submissions 에 '대기' 로 저장 → Judgement Operation 에서 검토
   - 내 제출 현황: 이 기기에서 낸 문서의 대기 · 승인 · 반려(사유) */
(function () {
  'use strict';
  var FB = window.RSSFB, P = window.RSSPaper, h = P.h;
  var auth = new FB.Auth('lr-auth'), main = document.getElementById('main'), dock = document.getElementById('dock');
  var DRAFT = 'lr-draft';
  var draft = {}; try { draft = JSON.parse(localStorage.getItem(DRAFT) || '{}'); } catch (e) {}
  if (!draft._no) draft._no = 'LR-' + Date.now().toString(36).toUpperCase().slice(-6);
  var saveT = 0;
  function keep(d) { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { flash('기기 저장 공간이 부족해 임시 저장을 못 했습니다', true); } stamp.textContent = '임시 저장 ' + new Date().toLocaleTimeString(); }, 400); }
  var stamp = h('span');
  var tab = 'write', ed = null;

  function flash(text, bad) {
    var old = document.querySelector('.msg.top'); if (old) old.remove();
    var m = h('div', { class: 'msg top' + (bad ? ' bad' : '') }, text); main.insertBefore(m, main.firstChild); m.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function ask(title, text, okText) {
    return new Promise(function (res) {
      var m = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h3', null, title), h('p', null, text),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: function () { m.remove(); res(false); } }, '취소'),
          h('button', { class: 'btn go', type: 'button', onclick: function () { m.remove(); res(true); } }, okText))));
      document.body.appendChild(m);
    });
  }

  /* ── 작성 ── */
  function write() {
    main.innerHTML = '';
    ed = P.editor(draft, keep);
    main.appendChild(ed.el);
    dock.hidden = false; dock.innerHTML = '';
    var send = h('button', { class: 'btn go', type: 'button', onclick: submit }, '서명하고 제출');
    dock.appendChild(h('div', { class: 'info' }, '접수 번호 ', h('b', null, draft._no), ' · ', stamp));
    dock.appendChild(h('div', { class: 'sp' }));
    dock.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () {
      ask('새 신청서', '지금 적은 내용을 모두 지우고 빈 신청서를 꺼낼까요?', '새로 쓰기').then(function (ok) { if (!ok) return; draft = { _no: 'LR-' + Date.now().toString(36).toUpperCase().slice(-6) }; localStorage.removeItem(DRAFT); P.pen('paper'); write(); });
    } }, '새 신청서'));
    dock.appendChild(send);
    function submit() {
      var miss = ed.missing();
      if (miss.length) { P.pen(); return flash('아직 적지 않은 필수 칸이 있습니다: ' + miss.join(' · '), true); }
      ask('제출하시겠습니까?', draft.name + ' 의 인물 등록 신청서를 R.S.S. 에 제출합니다. 제출한 뒤에는 고칠 수 없고, 검토 결과는 "내 제출 현황" 에서 볼 수 있습니다.', '제출').then(function (ok) {
        if (!ok) return;
        send.disabled = true; send.textContent = '제출 중…';
        var d = {}; Object.keys(draft).forEach(function (k) { if (k.charAt(0) !== '_') d[k] = draft[k]; });
        var payload = JSON.stringify(d);
        if (payload.length > 300000) { send.disabled = false; send.textContent = '서명하고 제출'; return flash('글이 너무 깁니다. 조금 줄여 주십시오', true); }
        auth.anon().then(function (tok) {
          return FB.add(tok, 'submissions', { status: 'pending', uid: auth.s.uid, createdAt: Date.now(), name: String(d.name).slice(0, 80), payload: payload, portrait: draft._portrait || '', signature: draft._sign || '', app: 'registry-1' });
        }).then(function (doc) {
          ed.stamp('접 수', '대기 · ' + doc.id.slice(0, 6).toUpperCase());
          try { var mine = JSON.parse(localStorage.getItem('lr-mine') || '[]'); mine.unshift({ id: doc.id, name: d.name, t: Date.now() }); localStorage.setItem('lr-mine', JSON.stringify(mine.slice(0, 100))); } catch (e) {}
          localStorage.removeItem(DRAFT);
          draft = { _no: 'LR-' + Date.now().toString(36).toUpperCase().slice(-6) };
          send.textContent = '제출 완료';
          flash('제출했습니다. Judgement Operation 에서 검토한 뒤 승인되면 R.S.S. 아카이브에 올라갑니다. 다음 신청서는 "새 신청서" 를 누르십시오.');
        }, function (e) { send.disabled = false; send.textContent = '서명하고 제출'; flash('제출하지 못했습니다 · ' + e.message, true); });
      });
    }
  }

  /* ── 내 제출 현황 ── */
  var LABEL = { pending: '검토 대기', approved: '승인 · 아카이브 등록', rejected: '반려' };
  function mine() {
    main.innerHTML = ''; dock.hidden = true;
    var box = h('div', { class: 'mine' }, h('h2', null, '내 제출 현황'), h('p', { class: 'd' }, '이 기기에서 제출한 신청서입니다. 승인되면 R.S.S. 아카이브에 인물 문서로 올라갑니다.'));
    var list = h('div', null, h('div', { class: 'empty' }, '불러오는 중…'));
    box.appendChild(list); main.appendChild(box);
    if (!auth.s) { list.innerHTML = ''; list.appendChild(h('div', { class: 'empty' }, '아직 제출한 신청서가 없습니다.')); return; }
    auth.token().then(function (tok) { return FB.query(tok, 'submissions', ['uid', auth.s.uid]); }).then(function (rows) {
      list.innerHTML = '';
      rows.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!rows.length) list.appendChild(h('div', { class: 'empty' }, '아직 제출한 신청서가 없습니다.'));
      rows.forEach(function (r) {
        var d = {}; try { d = JSON.parse(r.payload); } catch (e) {}
        list.appendChild(h('button', { class: 'sub', type: 'button', onclick: function () { view(r, d); } },
          h('div', null, h('b', null, r.name), h('span', null, new Date(r.createdAt).toLocaleString() + ' · ' + [d.org, d.rank, d.nation].filter(Boolean).join(' · '))),
          h('span', { class: 'st ' + r.status }, LABEL[r.status] || r.status),
          r.status === 'rejected' && r.reason ? h('div', { class: 'reason' }, '반려 사유: ' + r.reason) : null));
      });
    }, function (e) { list.innerHTML = ''; list.appendChild(h('div', { class: 'msg bad' }, '불러오지 못했습니다 · ' + e.message)); });
  }
  function view(r, d) {
    main.innerHTML = '';
    main.appendChild(h('button', { class: 'btn back', type: 'button', onclick: mine }, '‹ 목록으로'));
    var st = r.status === 'approved' ? { text: '승 인', sub: 'R.S.S. ARCHIVE' } : r.status === 'rejected' ? { text: '반 려', sub: r.reason || '', cls: 'no' } : { text: '대 기', sub: '검토 중', cls: 'wait' };
    main.appendChild(P.viewer(d, r.portrait, r.signature, { no: r.id.slice(0, 8).toUpperCase(), sub: '제출 ' + new Date(r.createdAt).toLocaleString(), stamp: st }));
  }

  [].forEach.call(document.querySelectorAll('.nav button'), function (b) {
    b.addEventListener('click', function () {
      tab = b.getAttribute('data-t'); P.pen('paper');
      [].forEach.call(document.querySelectorAll('.nav button'), function (x) { x.classList.toggle('on', x === b); });
      window.scrollTo(0, 0);
      if (tab === 'write') write(); else mine();
    });
  });
  write();
  if (window.RSSUpdate) window.RSSUpdate.check({ name: 'Leviathan Registry', current: window.APP_VERSION, tag: 'registry', apk: 'LeviathanRegistry.apk', accent: '#C9483B', lift: 72 });
})();
