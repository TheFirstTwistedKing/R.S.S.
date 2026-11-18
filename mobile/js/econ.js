/* 나라 화폐 지갑 · 환전 · 나라별 특산품 상점 · 기업 독점
   - 환전: LEVC ↔ 각 나라 화폐. 그 순간 환율에 0.5% 환전 수수료 (실제 환전소처럼 살 때 · 팔 때 값이 다름)
   - 특산품: 그 나라 화폐로만 살 수 있는 물건. 소장품으로 남음 (되팔 수 없음)
   - 독점: 기업 주가 × 150,000 (그 나라 화폐)을 그 순간 환율로 LEVC 에서 지불
     독점한 기업은 앱이 열려 있는 동안 1분마다 그 순간 독점 가치의 0.1% 를 그 나라 화폐로 지급 */
(function () {
  'use strict';
  var M = window.RSSM, K = M.market, S = M.store;
  var FEE = 0.005, MONO_X = 150000, MONO_YIELD = 0.001, MONO_EVERY = 60000;
  var E = M.econ = { FEE: FEE, MONO_X: MONO_X, MONO_YIELD: MONO_YIELD, listeners: [] };

  /* 나라별 특산품 (각 나라 기업과 연결된 물건 · 가격은 그 나라 화폐) */
  E.ITEMS = [
    { id: 'vec-coat', cur: 'VEC', ko: '천공월아 방한 야전 코트', by: '천공월아민간군사기업', price: 1850 },
    { id: 'vec-compass', cur: 'VEC', ko: '아크 공방 수제 나침반', by: '아크 공방기업', price: 420 },
    { id: 'vec-crest', cur: 'VEC', ko: '홍색산업 강철 문장', by: '홍색산업', price: 96 },
    { id: 'vec-key', cur: 'VEC', ko: '이한영의 부동산 별장 열쇠', by: '이한영의 부동산', price: 2400000 },
    { id: 'rtc-ring', cur: 'RTC', ko: '레벨리아 공방 은세공 반지', by: '레벨리아의 공방', price: 64000 },
    { id: 'rtc-term', cur: 'RTC', ko: 'C.O.R.E. 휴대 단말', by: 'C.O.R.E.', price: 920000 },
    { id: 'rtc-coin', cur: 'RTC', ko: '선형은행 기념 금화', by: '선형은행', price: 185000 },
    { id: 'rtc-tower', cur: 'RTC', ko: '막강건설사 전망대 평생 이용권', by: '막강건설사', price: 410000000 },
    { id: 'sd-lantern', cur: 'SD', ko: '별빛 공방 별자리 랜턴', by: '별빛 공방기업', price: 38500 },
    { id: 'sd-seal', cur: 'SD', ko: '환성감정소 감정 인장', by: '환성감정소', price: 72000 },
    { id: 'sd-badge', cur: 'SD', ko: 'STAR DEFENCE PROJECT 기념 휘장', by: 'STAR DEFENCE PROJECT', price: 155000 },
    { id: 'sd-crown', cur: 'SD', ko: 'C.R.O.W.N. 회원 왕관 배지', by: 'C.R.O.W.N.', price: 280000000 },
    { id: 'dem-leaf', cur: 'DEM', ko: '오색단풍 단풍잎 책갈피', by: '오색단풍', price: 128 },
    { id: 'dem-card', cur: 'DEM', ko: '켄의 복사점 한정 인쇄 엽서', by: '켄의 복사점', price: 18 },
    { id: 'dem-box', cur: 'DEM', ko: '료코 공방 칠기 상자', by: '료코의 공방기업', price: 2650 },
    { id: 'dem-house', cur: 'DEM', ko: '단풍건설사 단풍 정원 별채', by: '단풍건설사', price: 14800000 },
    { id: 'mec-ticket', cur: 'MEC', ko: '엘 항공사 1등석 탑승권', by: '엘 항공사', price: 6400 },
    { id: 'mec-note', cur: 'MEC', ko: '에스터 공방 가죽 수첩', by: '에스터 공방기업', price: 145 },
    { id: 'mec-ship', cur: 'MEC', ko: '환서조선 범선 모형', by: '환서조선', price: 980 },
    { id: 'mec-port', cur: 'MEC', ko: '라오스무역 전용 부두 사용권', by: '라오스무역', price: 3200000 },
    { id: 'eom-tour', cur: 'EOM', ko: '달 관광사 달빛 야간 투어권', by: '달 관광사', price: 38000 },
    { id: 'eom-bell', cur: 'EOM', ko: '월광 공방 은월 풍경', by: '월광 공방기업', price: 21500 },
    { id: 'eom-chip', cur: 'EOM', ko: '메모리 디벨롭 기억 보존 칩', by: '메모리 디벨롭 스튜디오', price: 1250000 },
    { id: 'eom-blade', cur: 'EOM', ko: '블러디어스 공방 장식 단검', by: '블러디어스 공방기업', price: 88000 }
  ];
  E.item = function (id) { return E.ITEMS.filter(function (i) { return i.id === id; })[0]; };

  function d() {
    var x = S.data;
    x.fxw = x.fxw || {}; K.NATIONS.forEach(function (n) { if (x.fxw[n] == null) x.fxw[n] = 0; });
    x.items = x.items || {}; x.mono = x.mono || {};
    return x;
  }
  E.data = d;
  function emit() { E.listeners.forEach(function (fn) { fn(); }); }
  function log(o) { var x = d(); o.t = Date.now(); x.log.unshift(o); if (x.log.length > 400) x.log.length = 400; }

  /* ── 환전 ── */
  E.quoteBuy = function (levc, cur) { return levc * K.fx(cur) * (1 - FEE); };            // LEVC → 나라 화폐
  E.quoteSell = function (local, cur) { return local / K.fx(cur) * (1 - FEE); };          // 나라 화폐 → LEVC
  E.exchange = function (dir, amount, cur) {
    var x = d(); amount = +amount;
    if (!(amount > 0)) return '금액을 입력하십시오';
    if (dir > 0) {                                                                         // LEVC 로 그 나라 화폐 사기
      if (amount > x.cash) return '현금(LEVC)이 부족합니다';
      var got = E.quoteBuy(amount, cur);
      x.cash -= amount; x.fxw[cur] += got;
      log({ k: 'fx', cur: cur, levc: -amount, local: got, fx: K.fx(cur) });
    } else {                                                                               // 그 나라 화폐를 LEVC 로
      if (amount > x.fxw[cur] + 1e-9) return cur + ' 잔액이 부족합니다';
      var lv = E.quoteSell(amount, cur);
      x.fxw[cur] -= amount; x.cash += lv;
      log({ k: 'fx', cur: cur, levc: lv, local: -amount, fx: K.fx(cur) });
    }
    S.save(); emit(); M.rec && M.rec.event('exchange');
    return null;
  };

  /* ── 특산품 ── */
  E.buyItem = function (id) {
    var it = E.item(id), x = d();
    if (x.fxw[it.cur] + 1e-9 < it.price) return it.cur + ' 잔액이 부족합니다. 먼저 환전하십시오';
    x.fxw[it.cur] -= it.price; x.items[id] = (x.items[id] || 0) + 1;
    log({ k: 'item', id: id, local: it.price, cur: it.cur });
    S.save(); emit(); M.rec && M.rec.event('item', it);
    return null;
  };

  /* ── 독점 ── */
  E.monoCostLocal = function (c) { return c.price * MONO_X; };
  E.monoCostLevc = function (c) { return K.toLevc(E.monoCostLocal(c), c.cur); };
  E.owns = function (id) { return !!d().mono[id]; };
  E.monopolize = function (id) {
    var c = K.co(id), x = d();
    if (x.mono[id]) return '이미 독점한 기업입니다';
    var local = E.monoCostLocal(c), levc = K.toLevc(local, c.cur);
    if (levc > x.cash) return '현금이 부족합니다 · 필요 ' + M.levc(levc);
    x.cash -= levc;
    x.mono[id] = { t: Date.now(), paid: levc, local: local, earned: 0, last: Date.now() };
    log({ k: 'mono', id: id, levc: levc, local: local, cur: c.cur, fx: K.fx(c.cur) });
    S.save(); S.flush(); emit(); M.rec && M.rec.event('mono', c);
    return null;
  };
  E.monoValue = function () { var x = d(), v = 0; Object.keys(x.mono).forEach(function (id) { var c = K.co(id); if (c) v += E.monoCostLevc(c); }); return v; };
  E.localValue = function () { var x = d(), v = 0; K.NATIONS.forEach(function (n) { v += K.toLevc(x.fxw[n] || 0, n); }); return v; };

  /* 독점 수익: 1분마다 (그 순간 독점 가치의 0.1%, 그 나라 화폐) */
  E.start = function () {
    d();
    setInterval(function () {
      var x = d(), now = Date.now(), paid = false;
      Object.keys(x.mono).forEach(function (id) {
        var m = x.mono[id], c = K.co(id); if (!c) return;
        if (now - m.last < MONO_EVERY) return;
        var times = Math.min(5, Math.floor((now - m.last) / MONO_EVERY));     // 앱이 잠깐 멈췄어도 최대 5분 몫까지만
        var amt = E.monoCostLocal(c) * MONO_YIELD * times;
        x.fxw[c.cur] += amt; m.earned += amt; m.last += times * MONO_EVERY; paid = true;
        M.rec && M.rec.event('monoIncome', { levc: K.toLevc(amt, c.cur) });
      });
      // 앱이 꺼져 있던 동안은 수익이 쌓이지 않음 (다시 열면 지금부터)
      if (paid) { S.save(); emit(); }
    }, 5000);
    // 다시 열었을 때는 꺼져 있던 시간을 빼고 지금부터 셈
    Object.keys(d().mono).forEach(function (id) { d().mono[id].last = Date.now(); });
  };
})();
