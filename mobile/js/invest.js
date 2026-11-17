/* 기업 투자 요청
   - 앱이 열려 있는 동안 5초마다 한 번 1% 확률로, 보유한 주식의 기업 중 한 곳이 투자를 요청함
   - 요청이 한 번 오면 150초 동안은 새 요청이 오지 않음 (쿨타임)
   - 비용: 5,000만 LEVC 이상(5,000만 ~ 1억 5,000만 LEVC 어치)을 그 기업 나라의 화폐로 제시
   - 받아들이면 투자금이 나가고, 60초 뒤 결과가 나옴
     결과는 1억 LEVC 를 중심으로: 오르면 1억 ~ 2억 LEVC, 떨어지면 0 ~ 1억 LEVC 를 돌려받음 (반반)
     오를지 떨어질지는 결과가 나오는 순간 정해지고, 확률은 화면 어디에도 표시하지 않음
   - 요청은 60초 안에 답하지 않으면 사라짐 */
(function () {
  'use strict';
  var M = window.RSSM, h = M.h, K = M.market, S = M.store;
  var ROLL_MS = 5000, CHANCE = 0.01, COOLDOWN = 150000, MIN_LEVC = 50000000, MAX_LEVC = 150000000;
  var CENTER = 100000000, WAIT = 60000, OFFER_TTL = 60000;
  var I = M.invest = { listeners: [] };
  function st() { var d = S.data; d.invest = d.invest || { cd: 0, req: null, active: [], hist: [] }; return d.invest; }
  function emit() { I.listeners.forEach(function (fn) { fn(); }); }
  function held() { var d = S.data; return Object.keys(d.holdings).filter(function (id) { return d.holdings[id].q > 0 && K.co(id); }); }

  /* 제시 금액: LEVC 로 정한 뒤 그 나라 화폐로 바꾸고 보기 좋게 올림 (올림이라 항상 5,000만 LEVC 이상) */
  function niceUp(v) { var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2)); return Math.ceil(v / p) * p; }
  function makeOffer(id) {
    var c = K.co(id), levc = MIN_LEVC * 1.01 + Math.random() * (MAX_LEVC - MIN_LEVC * 1.01);   // 1% 여유: 답하는 동안 환율이 조금 움직여도 5,000만 LEVC 이상
    return { id: id, local: niceUp(K.fromLevc(levc, c.cur)), cur: c.cur, t: Date.now(), until: Date.now() + OFFER_TTL };
  }

  I.start = function () {
    var s = st();
    // 꺼져 있던 동안 결과 시간이 지난 투자는 바로 결과 처리
    s.active.slice().forEach(function (a) { if (Date.now() >= a.at) resolve(a); });
    if (s.req && Date.now() > s.req.until) s.req = null;
    setInterval(function () {
      var s2 = st(), now = Date.now();
      s2.active.slice().forEach(function (a) { if (now >= a.at) resolve(a); });
      if (s2.req && now > s2.req.until) { s2.req = null; closeOffer(); S.save(); emit(); }
      if (s2.req || now < s2.cd) return;
      var ids = held(); if (!ids.length) return;
      if (Math.random() >= CHANCE) return;
      s2.req = makeOffer(ids[(Math.random() * ids.length) | 0]);
      s2.cd = now + COOLDOWN;                                               // 요청이 온 순간부터 150초
      S.save(); emit(); showOffer();
    }, ROLL_MS);
    if (s.req) showOffer();
  };

  /* 결과: 이 순간 50% 로 오름/떨어짐을 정하고, 1억 LEVC 를 중심으로 돌려받을 금액을 정함 */
  function resolve(a) {
    var s = st(), d = S.data, up = Math.random() < 0.5;
    var back = up ? CENTER + Math.random() * CENTER : Math.random() * CENTER;
    back = Math.round(back);
    s.active.splice(s.active.indexOf(a), 1);
    // 연구 성공(오름)이면 그 기업 주가가 크게 오름
    var boost = up ? K.boost(a.id) : 0;
    var r = { id: a.id, local: a.local, cur: a.cur, paid: a.paid, back: back, t: Date.now(), ok: up, boost: boost };
    s.hist.unshift(r); if (s.hist.length > 60) s.hist.pop();
    d.cash += back;
    d.log.unshift({ t: Date.now(), k: 'invr', id: a.id, levc: back, paid: a.paid });
    S.save(); S.flush(); emit(); showResult(r);
  }

  /* ── 요청 카드 ── */
  var box = null, tick = 0;
  function closeOffer() { clearInterval(tick); if (box) { var b = box; box = null; b.classList.remove('in'); setTimeout(function () { b.remove(); }, 250); } }
  function showOffer() {
    var s = st(), q = s.req; if (!q) return;
    closeOffer();
    var c = K.co(q.id), nat = K.FX.filter(function (f) { return f.code === c.cur; })[0];
    var left = h('b', { class: 'iv-left' }), eq = h('span', { class: 'iv-eq' });
    var yes = h('button', { class: 'btn buy', type: 'button', onclick: accept }, '투자');
    var no = h('button', { class: 'btn sell', type: 'button', onclick: function () { s.req = null; S.save(); M.sound.tap(); closeOffer(); emit(); } }, '거절');
    box = h('section', { class: 'iv', role: 'dialog', 'aria-label': '투자 요청' },
      h('div', { class: 'iv-top' }, h('span', { class: 'iv-k' }, 'INVESTMENT REQUEST'), left),
      h('div', { class: 'iv-co' }, c.ko),
      h('div', { class: 'iv-sub' }, nat.ko + ' · ' + c.sec + (c.risky ? ' · 고위험' : '')),
      h('p', { class: 'iv-msg' }, c.ko + '에서 연구 개발 자금 투자를 요청했습니다.'),
      h('div', { class: 'iv-amt' }, M.num(q.local) + ' ', h('em', null, q.cur)),
      eq,
      h('div', { class: 'iv-btns' }, yes, no));
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('in'); });
    M.sound.alert();
    var upd = function () {
      var ms = q.until - Date.now(); left.textContent = Math.max(0, Math.ceil(ms / 1000)) + '초';
      eq.textContent = '현재 환율 1 LEVC = ' + M.fx(K.fx(q.cur)) + ' ' + q.cur + ' · 약 ' + M.levc(K.toLevc(q.local, q.cur));
      if (ms <= 0) closeOffer();
    };
    upd(); tick = setInterval(upd, 250);
    function accept() {
      var d = S.data, levc = K.toLevc(q.local, q.cur);
      if (levc > d.cash) { M.sound.deny(); return M.toast('현금이 부족합니다 · 필요 ' + M.levc(levc)); }
      d.cash -= levc;
      s.active.push({ id: q.id, local: q.local, cur: q.cur, paid: levc, t: Date.now(), at: Date.now() + WAIT });
      d.log.unshift({ t: Date.now(), k: 'inv', id: q.id, levc: levc, local: q.local, cur: q.cur, fx: K.fx(q.cur) });
      s.req = null; S.save(); S.flush();
      M.sound.buy(); M.toast(c.ko + ' 에 ' + M.num(q.local) + ' ' + q.cur + ' 투자 · 60초 뒤 결과');
      closeOffer(); emit();
    }
  }

  /* ── 결과 카드 ── */
  function showResult(r) {
    var c = K.co(r.id), gain = r.back - r.paid, up = r.ok != null ? r.ok : r.back >= r.paid;
    var el = h('section', { class: 'iv in res ' + (up ? 'good' : 'bad'), role: 'dialog', 'aria-label': '투자 결과' },
      h('div', { class: 'iv-top' }, h('span', { class: 'iv-k' }, 'RESEARCH RESULT'), h('b', { class: 'iv-left ' + (up ? 'up' : 'down') }, up ? '연구 성공' : '연구 실패')),
      h('div', { class: 'iv-co' }, c ? c.ko : r.id),
      h('div', { class: 'iv-res' }, h('span', null, '투자금'), h('b', null, M.levc(r.paid))),
      h('div', { class: 'iv-res' }, h('span', null, '돌려받은 금액'), h('b', null, M.levc(r.back))),
      r.boost ? h('div', { class: 'iv-res' }, h('span', null, '주가'), h('b', { class: 'up' }, '급등 중 · 약 +' + Math.round(r.boost * 100) + '%')) : null,
      h('div', { class: 'iv-amt ' + (up ? 'up' : 'down') }, (gain >= 0 ? '+' : '−') + M.num(Math.abs(gain)), h('em', null, ' LEVC')),
      h('div', { class: 'iv-btns one' }, h('button', { class: 'btn buy', type: 'button', onclick: function () { el.classList.remove('in'); setTimeout(function () { el.remove(); }, 250); } }, '확인')));
    document.body.appendChild(el);
    if (up) M.sound.ok(); else M.sound.deny();
  }

  I.state = st;
  I.pending = function () { return st().active; };
  I.history = function () { return st().hist; };
  I.invested = function () { return st().active.reduce(function (s, a) { return s + a.paid; }, 0); };
})();
