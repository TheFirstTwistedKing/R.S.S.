/* Operation : L — 제출된 인물 문서를 검토하고 승인 · 반려. 승인하면 R.S.S. 아카이브(archive)에 올라감
   - 이메일 · 비밀번호 로그인 (Firebase 콘솔에서 만든 관리자 계정 하나)
   - 실제로 "나만" 되게 하는 것은 Firestore 보안 규칙: 규칙에 적힌 관리자 계정(UID)만 읽기 · 승인 · 반려 가능
   - 처음 로그인하면 이 계정의 UID 를 넣은 보안 규칙 전문을 보여 주고 복사할 수 있게 함 */
(function () {
  'use strict';
  var FB = window.RSSFB, P = window.RSSPaper, SC = window.RSSSchema, h = P.h;
  var auth = new FB.Auth('opl-auth'), app = document.getElementById('app');
  document.body.appendChild(h('div', { class: 'scan', 'aria-hidden': 'true' }));
  var tab = 'pending', cache = { submissions: [], archive: [] };

  function rules(uid) {
    return [
      "rules_version = '2';",
      "service cloud.firestore {",
      "  match /databases/{database}/documents {",
      "    // 관리자: Operation : L 에 로그인하는 계정 하나",
      "    function isOwner() { return request.auth != null && request.auth.uid == '" + uid + "'; }",
      "",
      "    // Leviathan Registry 제출 문서: 제출자는 자기 문서를 '대기' 로만 만들 수 있고 자기 것만 볼 수 있음",
      "    match /submissions/{id} {",
      "      allow create: if request.auth != null",
      "        && request.resource.data.uid == request.auth.uid",
      "        && request.resource.data.status == 'pending'",
      "        && request.resource.data.keys().hasOnly(['status', 'uid', 'createdAt', 'name', 'payload', 'portrait', 'signature', 'app'])",
      "        && request.resource.data.payload is string && request.resource.data.payload.size() < 300000",
      "        && request.resource.data.portrait is string && request.resource.data.portrait.size() < 300000",
      "        && request.resource.data.signature is string && request.resource.data.signature.size() < 150000;",
      "      allow read: if isOwner() || (request.auth != null && resource.data.uid == request.auth.uid);",
      "      allow update, delete: if isOwner();",
      "    }",
      "",
      "    // R.S.S. 아카이브: 누구나 읽기, 관리자만 쓰기",
      "    match /archive/{id} {",
      "      allow read: if true;",
      "      allow write: if isOwner();",
      "    }",
      "  }",
      "}"].join('\n');
  }
  function modal(title, text, body, buttons) {
    return new Promise(function (res) {
      var m = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h3', null, title), text ? h('p', null, text) : null, body || null,
        h('div', { class: 'row' }, buttons.map(function (b) { return h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: function () { m.remove(); res(b.v); } }, b.t); }))));
      document.body.appendChild(m);
    });
  }

  /* ── 로그인 ── */
  function login(errText) {
    app.innerHTML = '';
    var em = h('input', { class: 'inp', type: 'email', autocomplete: 'username', placeholder: 'admin@example.com' });
    var pw = h('input', { class: 'inp', type: 'password', autocomplete: 'current-password' });
    var err = h('p', { class: 'err' }, errText || ''), go = h('button', { class: 'btn go', type: 'submit', style: 'width:100%' }, '접속');
    var form = h('form', { class: 'lg-box' }, h('div', { class: 'lg-k' }, 'R.S.S. · REVIEW CONSOLE'), h('div', { class: 'lg-t' }, 'OPERATION : L'),
      h('p', { class: 'lg-d' }, '리바이어던 등록 문서 검토 · 관리자 전용'),
      h('label', { class: 'fld' }, h('span', null, 'EMAIL'), em), h('label', { class: 'fld' }, h('span', null, 'PASSWORD'), pw), go, err);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = ''; go.disabled = true; go.textContent = '확인 중…';
      auth.password(em.value.trim(), pw.value).then(function () { P.pen('stamp'); home(); }, function (x) { go.disabled = false; go.textContent = '접속'; err.textContent = x.message; });
    });
    app.appendChild(h('div', { class: 'login' }, form));
    setTimeout(function () { em.focus(); }, 50);
  }

  /* ── 본 화면 ── */
  function home() {
    app.innerHTML = '';
    var counts = { pending: h('b'), approved: h('b'), rejected: h('b'), archive: h('b') };
    var nav = h('div', { class: 'tabs' });
    [['pending', '검토 대기'], ['approved', '승인'], ['rejected', '반려'], ['archive', '아카이브'], ['rules', '보안 규칙']].forEach(function (t) {
      nav.appendChild(h('button', { type: 'button', class: tab === t[0] ? 'on' : '', 'data-t': t[0], onclick: function () { tab = t[0]; P.pen('paper'); [].forEach.call(nav.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); }); draw(); } }, t[1], counts[t[0]] || null));
    });
    var body = h('div');
    app.appendChild(h('header', { class: 'top' }, h('div', { class: 'top-t' }, 'OPERATION : L', h('span', null, 'REVIEW')), nav,
      h('div', { class: 'who' }, auth.s.email, h('button', { type: 'button', onclick: function () { load(); } }, '새로고침'), h('button', { type: 'button', onclick: function () { auth.out(); login(); } }, '로그아웃'))));
    app.appendChild(body);
    var denied = false;
    function load() {
      body.innerHTML = ''; body.appendChild(h('div', { class: 'wrap' }, h('div', { class: 'empty' }, '불러오는 중…')));
      auth.token().then(function (tok) { return Promise.all([FB.list(tok, 'submissions'), FB.list(tok, 'archive').catch(function () { return []; })]); }).then(function (r) {
        denied = false; cache.submissions = r[0]; cache.archive = r[1]; count(); draw();
      }, function (e) {
        if (e.code === 'UNAUTHENTICATED') { auth.out(); return login(e.message); }
        denied = /권한|PERMISSION/.test(e.message) || e.code === 'PERMISSION_DENIED';
        if (denied) { tab = 'rules'; [].forEach.call(nav.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === 'rules'); }); }
        draw(e);
      });
    }
    function count() {
      ['pending', 'approved', 'rejected'].forEach(function (s) { counts[s].textContent = String(cache.submissions.filter(function (x) { return x.status === s; }).length); });
      counts.archive.textContent = String(cache.archive.length);
    }
    function draw(e) {
      body.innerHTML = '';
      var w = h('div', { class: 'wrap' }); body.appendChild(w);
      if (tab === 'rules') return rulesView(w, denied, e);
      if (e) { w.appendChild(h('div', { class: 'note bad' }, '불러오지 못했습니다 · ' + e.message)); return; }
      if (tab === 'archive') return archiveView(w);
      var rows = cache.submissions.filter(function (x) { return x.status === tab; }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!rows.length) { w.appendChild(h('div', { class: 'empty' }, { pending: '검토할 문서가 없습니다.', approved: '승인한 문서가 없습니다.', rejected: '반려한 문서가 없습니다.' }[tab])); return; }
      rows.forEach(function (r) { w.appendChild(card(r, function () { open(r); })); });
    }
    function card(r, onClick) {
      var d = {}; try { d = JSON.parse(r.payload); } catch (x) {}
      return h('button', { class: 'card', type: 'button', onclick: onClick },
        h('div', { class: 'ph', style: r.portrait ? 'background-image:url(' + r.portrait + ')' : '' }),
        h('div', null, h('b', null, r.name || d.name), h('span', null, [d.org, d.rank, d.nation, d.status].filter(Boolean).join(' · ')), r.reason ? h('span', null, '반려 사유: ' + r.reason) : null),
        h('em', null, new Date(r.createdAt || r.approvedAt || Date.now()).toLocaleString()));
    }

    /* 문서 열기 · 승인 · 반려 */
    function open(r) {
      var d = {}; try { d = JSON.parse(r.payload); } catch (x) {}
      body.innerHTML = '';
      var st = r.status === 'approved' ? { text: '승 인', sub: 'R.S.S. ARCHIVE' } : r.status === 'rejected' ? { text: '반 려', sub: r.reason || '', cls: 'no' } : null;
      var desk = h('div', { class: 'desk' }, P.viewer(d, r.portrait, r.signature, { no: r.id.slice(0, 8).toUpperCase(), sub: '제출 ' + new Date(r.createdAt).toLocaleString() + ' · 제출자 ' + (r.uid || '').slice(0, 8), stamp: st }));
      var bar = h('div', { class: 'act' }, h('span', { class: 'sp' }, '상태: ' + ({ pending: '검토 대기', approved: '승인됨 · 아카이브 등록', rejected: '반려됨' }[r.status] || r.status)),
        h('button', { class: 'btn', type: 'button', onclick: function () { draw(); } }, '목록'));
      if (r.status !== 'approved') bar.appendChild(h('button', { class: 'btn go', type: 'button', onclick: function () { approve(r, d); } }, '승인 · 아카이브 등록'));
      if (r.status !== 'rejected') bar.appendChild(h('button', { class: 'btn no', type: 'button', onclick: function () { reject(r); } }, r.status === 'approved' ? '아카이브에서 내리기' : '반려'));
      body.appendChild(desk); body.appendChild(bar); window.scrollTo(0, 0);
    }
    function approve(r, d) {
      modal('승인', d.name + ' 문서를 승인하고 R.S.S. 아카이브에 올립니다.', null, [{ t: '취소', v: false }, { t: '승인', cls: 'go', v: true }]).then(function (ok) {
        if (!ok) return;
        var now = Date.now();
        auth.token().then(function (tok) {
          return FB.commit(tok, [
            { path: 'archive/' + r.id, data: { name: r.name || d.name, payload: r.payload, portrait: r.portrait || '', approvedAt: now, createdAt: r.createdAt || now, subId: r.id } },
            { path: 'submissions/' + r.id, data: { status: 'approved', reviewedAt: now, reason: '' }, mask: true }]);
        }).then(function () {
          P.pen('stamp'); r.status = 'approved'; r.reason = ''; r.reviewedAt = now;
          cache.archive = cache.archive.filter(function (a) { return a.id !== r.id; }).concat([{ id: r.id, name: r.name, payload: r.payload, portrait: r.portrait, approvedAt: now }]);
          count(); open(r);
        }, function (e) { modal('승인하지 못했습니다', e.message, null, [{ t: '확인', v: 1 }]); });
      });
    }
    function reject(r) {
      var ta = h('textarea', { class: 'inp', placeholder: '반려 사유 (제출자에게 보입니다)' });
      var wasApproved = r.status === 'approved';
      modal(wasApproved ? '아카이브에서 내리기' : '반려', wasApproved ? '아카이브에서 내리고 반려 상태로 바꿉니다.' : '반려 사유를 적어 주십시오.', ta, [{ t: '취소', v: false }, { t: wasApproved ? '내리기' : '반려', cls: 'no', v: true }]).then(function (ok) {
        if (!ok) return;
        var reason = ta.value.trim() || (wasApproved ? '아카이브에서 내림' : '사유 없음'), now = Date.now();
        auth.token().then(function (tok) {
          var w = [{ path: 'submissions/' + r.id, data: { status: 'rejected', reviewedAt: now, reason: reason }, mask: true }];
          if (wasApproved) w.push({ path: 'archive/' + r.id, del: true });
          return FB.commit(tok, w);
        }).then(function () {
          P.pen('stamp'); r.status = 'rejected'; r.reason = reason;
          cache.archive = cache.archive.filter(function (a) { return a.id !== r.id; });
          count(); open(r);
        }, function (e) { modal('처리하지 못했습니다', e.message, null, [{ t: '확인', v: 1 }]); });
      });
    }
    function archiveView(w) {
      w.appendChild(h('div', { class: 'note' }, 'R.S.S. 아카이브에 올라간 인물 문서입니다. R.S.S. 앱은 켤 때 이 목록을 받아 아카이브에 표시합니다.'));
      if (!cache.archive.length) { w.appendChild(h('div', { class: 'empty' }, '아직 올라간 문서가 없습니다.')); return; }
      cache.archive.slice().sort(function (a, b) { return (b.approvedAt || 0) - (a.approvedAt || 0); }).forEach(function (a) {
        var sub = cache.submissions.filter(function (s) { return s.id === a.id; })[0] || a;
        w.appendChild(card(sub, function () { open(sub); }));
      });
    }
    function rulesView(w, deniedNow, e) {
      var uid = auth.s.uid, text = rules(uid);
      if (deniedNow) w.appendChild(h('div', { class: 'note bad' }, '이 계정으로는 아직 문서를 볼 수 없습니다. 아래 보안 규칙을 Firebase 에 붙여 넣으면 이 계정만 검토할 수 있게 됩니다.'));
      else if (e) w.appendChild(h('div', { class: 'note bad' }, e.message));
      w.appendChild(h('p', null, '이 관리자 계정의 UID: ', h('span', { class: 'uid' }, uid)));
      w.appendChild(h('ol', { class: 'steps' },
        h('li', null, 'Firebase 콘솔 → Firestore Database → 규칙(Rules) 탭을 엽니다.'),
        h('li', null, '원래 있던 내용을 모두 지우고, 아래 규칙을 붙여 넣은 뒤 "게시(Publish)" 를 누릅니다.'),
        h('li', null, '이 앱에서 "새로고침" 을 누릅니다.')));
      var copy = h('button', { class: 'btn go', type: 'button', onclick: function () {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { copy.textContent = '복사했습니다'; }, function () { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = '선택했습니다 · Ctrl+C'; });
      } }, '규칙 복사');
      var pre = h('pre', { class: 'rules' }, text);
      w.appendChild(copy); w.appendChild(h('div', { style: 'height:12px' })); w.appendChild(pre);
    }
    load();
  }

  if (auth.s) home(); else login();
})();
