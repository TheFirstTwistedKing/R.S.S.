/* 기록 · 업적: 최고 자산 · 연구 결과 · 작업 연속 일수 · 독점 수익 등을 모으고, 조건을 채우면 업적이 열림 */
(function () {
  'use strict';
  var M = window.RSSM, K = M.market, S = M.store;
  var R = M.rec = { listeners: [] };
  var ACH = [
    { id: 'buy1', ko: '첫 매수', d: '주식을 처음 샀다' },
    { id: 'risky', ko: '위험을 즐기는 자', d: '고위험 기업 주식을 보유했다' },
    { id: 'nations', ko: '여섯 나라의 주주', d: '6개국 기업 주식을 동시에 보유했다' },
    { id: 'rs-ok', ko: '첫 연구 성공', d: '투자한 연구가 처음 성공했다' },
    { id: 'rs-fail', ko: '쓴맛', d: '투자한 연구가 처음 실패했다' },
    { id: 'rs-ok5', ko: '연구 후원자', d: '연구 성공 5회' },
    { id: 'm100', ko: '1억 클럽', d: '총 자산 1억 LEVC' },
    { id: 'm1b', ko: '10억 클럽', d: '총 자산 10억 LEVC' },
    { id: 'm10b', ko: '100억 클럽', d: '총 자산 100억 LEVC' },
    { id: 'mono1', ko: '첫 독점', d: '기업 하나를 독점했다' },
    { id: 'mono5', ko: '재벌', d: '기업 5곳을 독점했다' },
    { id: 'monoNat', ko: '나라의 주인', d: '한 나라의 기업을 모두 독점했다' },
    { id: 'fx1', ko: '환전소 단골', d: '처음으로 환전했다' },
    { id: 'item1', ko: '첫 특산품', d: '나라 특산품을 처음 샀다' },
    { id: 'item6', ko: '여행가', d: '6개국 특산품을 하나씩 모았다' },
    { id: 'streak3', ko: '성실한 기술자', d: '장치 활성화 3일 연속' },
    { id: 'streak7', ko: '일주일 근속', d: '장치 활성화 7일 연속' },
    { id: 'alljobs', ko: '하루 완수', d: '하루에 일 3가지를 모두 끝냈다' }
  ];
  R.ACH = ACH;
  function st() {
    var d = S.data;
    d.stats = d.stats || { peak: 0, rsOk: 0, rsFail: 0, streak: 0, best: 0, lastDay: '', workPay: 0, monoIncome: 0, trades: 0 };
    d.ach = d.ach || {};
    return d.stats;
  }
  R.stats = st;
  function unlock(id) {
    var d = S.data; st();
    if (d.ach[id]) return;
    d.ach[id] = Date.now();
    var a = ACH.filter(function (x) { return x.id === id; })[0];
    S.save(); M.sound.ok(); M.toast('업적 달성 · ' + a.ko);
    R.listeners.forEach(function (fn) { fn(); });
  }
  function yesterday() { var t = new Date(); t.setDate(t.getDate() - 1); return M.day(t.getTime()); }

  /* 사건이 생길 때마다 기록 · 업적 확인 */
  R.event = function (kind, x) {
    var s = st(), d = S.data;
    if (kind === 'buy') { s.trades++; unlock('buy1'); if (x && x.risky) unlock('risky');
      var nats = {}; Object.keys(d.holdings).forEach(function (id) { var c = K.co(id); if (c && d.holdings[id].q > 0) nats[c.cur] = 1; });
      if (Object.keys(nats).length >= K.NATIONS.length) unlock('nations'); }
    if (kind === 'sell') s.trades++;
    if (kind === 'research') { if (x) { s.rsOk++; unlock('rs-ok'); if (s.rsOk >= 5) unlock('rs-ok5'); } else { s.rsFail++; unlock('rs-fail'); } }
    if (kind === 'exchange') unlock('fx1');
    if (kind === 'item') { unlock('item1'); var cs = {}; Object.keys(d.items).forEach(function (id) { var it = M.econ.item(id); if (it) cs[it.cur] = 1; }); if (Object.keys(cs).length >= K.NATIONS.length) unlock('item6'); }
    if (kind === 'mono') {
      var ids = Object.keys(d.mono); unlock('mono1'); if (ids.length >= 5) unlock('mono5');
      K.NATIONS.forEach(function (n) { var all = K.CO.filter(function (c) { return c.cur === n; }); if (all.every(function (c) { return d.mono[c.id]; })) unlock('monoNat'); });
    }
    if (kind === 'monoIncome') s.monoIncome += x.levc;
    if (kind === 'work') {
      s.workPay += x.pay;
      if (x.job === 'device') {
        var today = M.day();
        if (s.lastDay !== today) { s.streak = s.lastDay === yesterday() ? s.streak + 1 : 1; s.lastDay = today; s.best = Math.max(s.best, s.streak); }
        if (s.streak >= 3) unlock('streak3'); if (s.streak >= 7) unlock('streak7');
      }
      var j = d.jobs || {}, today2 = M.day();
      if (d.work && d.work.day === today2 && j.cipher === today2 && j.signal === today2) unlock('alljobs');
    }
    S.save();
  };
  /* 자산 최고 기록 (앱이 주기적으로 알려 줌) */
  R.total = function (v) {
    var s = st(); if (v > s.peak) s.peak = v;
    if (v >= 1e8) unlock('m100'); if (v >= 1e9) unlock('m1b'); if (v >= 1e10) unlock('m10b');
  };
})();
