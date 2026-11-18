/* 시장 엔진: 네 나라의 환율(1 LEVC 당) + 기업 16곳의 주가(각 나라 화폐)
   - 환율 기준값: R.S.S. 경제 창과 같음 (2026-11-17 대응 실제 통화 기준)
   - 시장 시간은 실제의 60배, 0.25초마다 가격이 바뀌고 3초마다 봉 하나
   - 주가: 기업마다 다른 하루 변동성 + 나라 경기 요인 + 가끔 소식에 따른 급변동
     고위험 4곳(천공월아민간군사기업 · C.O.R.E. · STAR DEFENCE PROJECT · 오색단풍)은 주가가 높고
     하루 변동성이 아주 크며, 크게 오르거나 크게 떨어지는 급변동이 자주 나옴
   - 앱이 꺼져 있는 동안에는 시장도 멈춤 (켜면 멈춘 자리에서 이어짐) */
(function () {
  'use strict';
  var M = window.RSSM;
  var EUR = 0.908584;
  var FX = [
    { code: 'VEC', ko: '버믹쿠루시아', base: EUR * 1.95583, vol: 0.48, eur: 1, spr: 0.012 },
    { code: 'RTC', ko: '레스렉시온', base: EUR * 166.386, vol: 0.5, eur: 1, spr: 0.02 },
    { code: 'SD', ko: '아스트랄리스', base: 124.097, vol: 0.75, eur: 0.5, spr: 0.09 },
    { code: 'DEM', ko: '추풍(秋楓)', base: 6.67926, vol: 0.22, eur: 0, spr: 0.03, kappa: 0.006 },
    { code: 'MEC', ko: '엘라렌', base: 1.42937, vol: 0.45, eur: 0.2, spr: 0.015 },
    { code: 'EOM', ko: '은월(銀月)', base: 159.58, vol: 0.7, eur: 0.1, spr: 0.015 }
  ];
  // 기업: id · 이름 · 나라 화폐 · 시작 주가 · 하루 변동성(%) · 고위험 여부 · 업종
  var CO = [
    { id: 'cg-pmc', ko: '천공월아민간군사기업', cur: 'VEC', base: 2480, vol: 9, risky: true, sec: '민간 군사' },
    { id: 'ark', ko: '아크 공방기업', cur: 'VEC', base: 186.4, vol: 2.2, sec: '공방 · 제작' },
    { id: 'hongsaek', ko: '홍색산업', cur: 'VEC', base: 64.5, vol: 1.8, sec: '중공업' },
    { id: 'lhy-re', ko: '이한영의 부동산', cur: 'VEC', base: 92.3, vol: 1.4, sec: '부동산' },
    { id: 'rebelia', ko: '레벨리아의 공방', cur: 'RTC', base: 18400, vol: 2.3, sec: '공방 · 제작' },
    { id: 'core', ko: 'C.O.R.E.', cur: 'RTC', base: 412000, vol: 9.5, risky: true, sec: '첨단 기술' },
    { id: 'linear', ko: '선형은행', cur: 'RTC', base: 9650, vol: 1.3, sec: '금융' },
    { id: 'makgang', ko: '막강건설사', cur: 'RTC', base: 6320, vol: 2.0, sec: '건설' },
    { id: 'sdp', ko: 'STAR DEFENCE PROJECT', cur: 'SD', base: 385000, vol: 10, risky: true, sec: '방위 산업' },
    { id: 'starlight', ko: '별빛 공방기업', cur: 'SD', base: 21800, vol: 2.2, sec: '공방 · 제작' },
    { id: 'hwanseong', ko: '환성감정소', cur: 'SD', base: 14200, vol: 1.6, sec: '감정 · 인증' },
    { id: 'crown', ko: 'C.R.O.W.N.', cur: 'SD', base: 33500, vol: 2.6, sec: '복합 기업' },
    { id: 'osaek', ko: '오색단풍', cur: 'DEM', base: 18800, vol: 9, risky: true, sec: '복합 기업' },
    { id: 'ken', ko: '켄의 복사점', cur: 'DEM', base: 42.6, vol: 1.5, sec: '인쇄 · 복사' },
    { id: 'dp-build', ko: '단풍건설사', cur: 'DEM', base: 88.4, vol: 2.0, sec: '건설' },
    { id: 'ryoko', ko: '료코의 공방기업', cur: 'DEM', base: 156, vol: 2.1, sec: '공방 · 제작' },
    { id: 'el-air', ko: '엘 항공사', cur: 'MEC', base: 1240, vol: 9, risky: true, sec: '항공' },
    { id: 'seongmin', ko: '성민물류', cur: 'MEC', base: 46.8, vol: 1.6, sec: '물류' },
    { id: 'laos', ko: '라오스무역', cur: 'MEC', base: 2960, vol: 9.5, risky: true, sec: '무역' },
    { id: 'ester', ko: '에스터 공방기업', cur: 'MEC', base: 112.5, vol: 2.1, sec: '공방 · 제작' },
    { id: 'hwanseo', ko: '환서조선', cur: 'MEC', base: 78.2, vol: 2.2, sec: '조선' },
    { id: 'grace', ko: '그레이스 물류산업', cur: 'MEC', base: 64.4, vol: 1.7, sec: '물류' },
    { id: 'memory', ko: '메모리 디벨롭 스튜디오', cur: 'EOM', base: 268000, vol: 10, risky: true, sec: '메모리 기술 개발' },
    { id: 'moon-tour', ko: '달 관광사', cur: 'EOM', base: 4180, vol: 1.9, sec: '관광' },
    { id: 'wolgwang', ko: '월광 공방기업', cur: 'EOM', base: 12650, vol: 2.2, sec: '공방 · 제작' },
    { id: 'bloodyus', ko: '블러디어스 공방기업', cur: 'EOM', base: 9870, vol: 2.4, sec: '공방 · 제작' }
  ];
  var NATIONS = ['VEC', 'RTC', 'SD', 'DEM', 'MEC', 'EOM'];
  var TICK = 250, PER = 12, SPEED = 60, KEEP = 200;
  var tv = Math.sqrt(TICK / 1000 * SPEED / 86400);
  function g() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  var K = M.market = { FX: FX, CO: CO, NATIONS: NATIONS, listeners: [], news: [], running: false };
  K.fx = function (code) { return code === 'LEVC' ? 1 : FX.filter(function (f) { return f.code === code; })[0].price; };
  K.co = function (id) { return CO.filter(function (c) { return c.id === id; })[0]; };
  K.toLevc = function (amount, cur) { return amount / K.fx(cur); };          // 그 나라 화폐 → LEVC
  K.fromLevc = function (levc, cur) { return levc * K.fx(cur); };

  /* 저장된 상태에서 시작 (없으면 기준값 + 지난 봉 120개를 같은 규칙으로 미리 계산) */
  K.start = function (saved) {
    if (K.running) return;
    var all = FX.concat(CO);
    all.forEach(function (a) { a.anchor = Math.log(a.base); a.x = a.anchor; a.hv = 1; a.candles = []; a.bar = null; a.price = a.base; });
    var fresh = !saved || !saved.x;
    if (!fresh) {
      all.forEach(function (a) {
        var key = a.code || a.id;
        if (saved.x[key] != null) a.x = saved.x[key];
        if (saved.c && saved.c[key]) a.candles = saved.c[key].map(function (c, i, arr) { return { t: Date.now() - (arr.length - i) * 3000, o: c[0], h: c[1], l: c[2], c: c[3] }; });
        if (saved.open && saved.open[key]) a.open0 = saved.open[key];
      });
    }
    // 지난 봉이 없는 것(처음 실행 · 새로 추가된 나라와 기업)만 지난 봉 120개를 미리 계산.
    // 이미 저장된 것은 미리 계산하는 동안 움직이지 않게 상태를 보관했다가 되돌림
    var missing = all.filter(function (a) { return !a.candles.length; });
    if (missing.length) {
      var keep = all.filter(function (a) { return a.candles.length; }).map(function (a) { return { a: a, x: a.x, c: a.candles.slice(), b: a.bar, hv: a.hv, j: a.jump }; });
      for (var i = 0; i < 120 * PER; i++) step(Date.now() - (120 * PER - i) * TICK, true);
      keep.forEach(function (k) { k.a.x = k.x; k.a.candles = k.c; k.a.bar = k.b; k.a.hv = k.hv; k.a.jump = k.j; });
    }
    all.forEach(function (a) { a.price = Math.exp(a.x); if (!a.open0) a.open0 = a.candles.length ? a.candles[0].o : a.price; });
    K.running = true;
    setInterval(function () { step(Date.now(), false); }, TICK);
    (function sched() { setTimeout(function () { news(); sched(); }, 18000 + Math.random() * 30000); })();
  };
  /* 보관소에 넣을 상태 (봉은 최근 120개만) */
  K.snapshot = function () {
    var o = { x: {}, c: {}, open: {} }, r = function (v) { return +v.toPrecision(8); };
    FX.concat(CO).forEach(function (a) {
      var key = a.code || a.id;
      o.x[key] = a.x; o.open[key] = r(a.open0);
      o.c[key] = a.candles.slice(-120).map(function (c) { return [r(c.o), r(c.h), r(c.l), r(c.c)]; });
    });
    return o;
  };

  var F = { eur: 1, usd: 1 }, NAT = {};
  NATIONS.forEach(function (n) { NAT[n] = { h: 1 }; });
  function step(now, silent) {
    var zu = g(), ze = g();
    F.usd = Math.max(0.5, Math.min(4, 0.985 * F.usd + 0.015 * (0.6 + 0.4 * zu * zu)));
    F.eur = Math.max(0.5, Math.min(4, 0.985 * F.eur + 0.015 * (0.6 + 0.4 * ze * ze)));
    var zn = {};
    NATIONS.forEach(function (n) { var e = g(); NAT[n].h = Math.max(0.5, Math.min(4, 0.98 * NAT[n].h + 0.02 * (0.6 + 0.4 * e * e))); zn[n] = e * Math.sqrt(NAT[n].h); });
    FX.forEach(function (a) {
      var e = g(); a.hv = Math.max(0.45, Math.min(5, 0.97 * a.hv + 0.03 * (0.5 + 0.5 * e * e)));
      var sh = a.vol / 100 * tv * (0.55 * zu * Math.sqrt(F.usd) + 0.6 * a.eur * ze * Math.sqrt(F.eur) + 0.45 * e * Math.sqrt(a.hv) - 0.25 * zn[a.code]);
      move(a, sh, a.kappa || 0.0006, now);
    });
    CO.forEach(function (a) {
      var e = g(); a.hv = Math.max(0.45, Math.min(6, 0.97 * a.hv + 0.03 * (0.5 + 0.5 * e * e)));
      var sh = a.vol / 100 * tv * (0.45 * zn[a.cur] + 0.85 * e * Math.sqrt(a.hv));
      // 고위험 기업: 아주 드물게 저절로 큰 급등 · 급락 (한 틱에 ±3~9%)
      if (a.risky && Math.random() < 0.0009) { a.jump = (a.jump || 0) + (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.06); a.hv = Math.min(6, a.hv + 2.5); }
      move(a, sh, 0.00004, now);
    });
    if (!silent) K.listeners.forEach(function (fn) { fn(); });
  }
  function move(a, sh, kappa, now) {
    if (a.jump) { sh += a.jump / 5; a.jump *= 4 / 5; if (Math.abs(a.jump) < 1e-5) a.jump = 0; }
    a.x += sh - kappa * (a.x - a.anchor);
    var p = Math.exp(a.x);
    // 지금 만들어지는 봉은 a.bar (기업의 화폐 코드 a.cur 와 이름이 겹치지 않게)
    if (!a.bar || a.bar.n >= PER) { if (a.bar) { a.candles.push(a.bar); if (a.candles.length > KEEP) a.candles.shift(); } a.bar = { t: now, o: p, h: p, l: p, c: p, n: 0 }; }
    var k = a.bar; k.h = Math.max(k.h, p); k.l = Math.min(k.l, p); k.c = p; k.n++;
    a.price = p;
  }

  /* 소식: 기업 · 나라 · 환율에 영향 */
  var CO_NEWS = [
    ['{n}, 대형 계약 수주', 1, 1], ['{n}, 분기 실적 예상치 상회', 1, 0.8], ['{n}, 신제품 공개 호평', 1, 0.6], ['{n}, 핵심 인력 이탈 소문', -1, 0.6],
    ['{n}, 분기 실적 부진', -1, 0.8], ['{n}, 안전 사고로 작업 중단', -1, 1], ['{n}, 자사주 매입 발표', 1, 0.5], ['{n}, 감사 의견 논란', -1, 0.9]
  ];
  var RISKY_NEWS = [['{n}, 극비 계약 체결설에 폭등', 1, 1], ['{n}, 대규모 손실 발표에 폭락', -1, 1], ['{n}, 정부 조사 착수', -1, 0.8], ['{n}, 독점 공급권 확보', 1, 0.9]];
  var NAT_NEWS = [['{n} 중앙은행 기준금리 인상', 1], ['{n} 중앙은행 기준금리 인하', -1], ['{n} 경기 지표 호조', 1], ['{n} 경기 둔화 우려', -1]];
  function news() {
    var r = Math.random(), item;
    if (r < 0.62) {
      var c = CO[(Math.random() * CO.length) | 0], pool = c.risky && Math.random() < 0.6 ? RISKY_NEWS : CO_NEWS, n = pool[(Math.random() * pool.length) | 0];
      var size = c.risky ? (0.12 + Math.random() * 0.22) : (0.015 + Math.random() * 0.04) * n[2];   // 고위험: 12~34% · 일반: 1.5~5.5%
      c.jump = (c.jump || 0) + n[1] * size; c.hv = Math.min(6, c.hv + (c.risky ? 3 : 1.5));
      item = { t: Date.now(), m: n[0].replace('{n}', c.ko), dir: n[1], tag: c.ko, big: !!c.risky };
    } else {
      var f = FX[(Math.random() * FX.length) | 0], m = NAT_NEWS[(Math.random() * NAT_NEWS.length) | 0];
      // 금리 인상 · 경기 호조 → 그 나라 화폐 강세(1 LEVC 당 숫자 감소) · 그 나라 기업 주가에도 영향
      f.jump = (f.jump || 0) - m[1] * f.vol / 100 * tv * 18; f.hv = Math.min(5, f.hv + 1.5);
      CO.filter(function (c) { return c.cur === f.code; }).forEach(function (c) { c.jump = (c.jump || 0) + m[1] * (m[0].indexOf('금리') >= 0 ? -0.006 : 0.012); });
      item = { t: Date.now(), m: m[0].replace('{n}', f.ko), dir: m[1], tag: f.code };
    }
    K.news.unshift(item); if (K.news.length > 30) K.news.pop();
  }
  K.change = function (a) { return (a.price / a.open0 - 1) * 100; };
  /* 연구 성공: 그 기업 주가가 크게 뜀 (일반 +35~70%, 고위험 +60~150%)
     몇 초에 걸쳐 오르고, 기준값도 함께 올려서 금방 원래 자리로 돌아가지 않게 함 */
  /* 연구 실패: 그 기업 주가가 크게 떨어짐 (일반 −15~30%, 고위험 −30~55%) · 기준값도 함께 내림 */
  K.crash = function (id) {
    var c = K.co(id); if (!c) return 0;
    var down = c.risky ? 0.3 + Math.random() * 0.25 : 0.15 + Math.random() * 0.15, lj = Math.log(1 - down);
    c.jump = (c.jump || 0) + lj; c.anchor += lj * 0.8; c.hv = Math.min(6, c.hv + 3);
    K.news.unshift({ t: Date.now(), m: c.ko + ', 연구 실패 발표 · 주가 급락', dir: -1, tag: c.ko, big: true }); if (K.news.length > 30) K.news.pop();
    return down;
  };
  K.boost = function (id) {
    var c = K.co(id); if (!c) return 0;
    var up = c.risky ? 0.6 + Math.random() * 0.9 : 0.35 + Math.random() * 0.35, lj = Math.log(1 + up);
    c.jump = (c.jump || 0) + lj; c.anchor += lj * 0.8; c.hv = Math.min(6, c.hv + 3);
    K.news.unshift({ t: Date.now(), m: c.ko + ', 연구 성공 발표 · 주가 급등', dir: 1, tag: c.ko, big: true }); if (K.news.length > 30) K.news.pop();
    return up;
  };
})();
