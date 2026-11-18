/* 경제 · 환율 (ECO-01): 나라별 화폐와 리바이어던 공용 화폐(LEVC) 기준 환율을 실시간으로 보여 줌
   ─ 기준값: 각 나라에 대응하는 실제 통화의 2026-11-17 USD 환율 (LEVC = USD 로 대응)
       · open.er-api.com 과 fawazahmed0 currency-api 두 곳의 값이 0.2% 안에서 일치함을 확인
       · 벨기에 · 스페인 · 독일 · 그리스는 모두 유로를 써서 값이 같아지므로, 유로 환율에 각 나라의
         옛 통화(BEF · ESP · DEM · GRD) 고정 전환율을 곱해 나라마다 다른 크기의 숫자를 씀
       · 그린란드는 덴마크 크로네를 쓰므로 IOD 와 PFD 는 같은 값에서 출발해 따로 움직임
   ─ 움직임(실제 외환시장처럼): 시장 시간은 실제의 60배 (1초 = 시장 1분)
       · 공통 요인(LEVC 강약) · 권역 요인(유로권 · 북유럽 고정환율 · 원자재 통화 · 위험 회피)
       · 통화마다 다른 하루 변동성, 변동성 뭉침(큰 움직임 뒤에 큰 움직임), 기준값으로 천천히 돌아오는 힘
       · 관리 환율(추풍 DEM)은 좁은 띠, 가끔 경제 소식이 나오며 해당 통화가 크게 움직임
       · 0.25초마다 가격이 바뀌고, 3초마다 봉(캔들) 하나가 완성되어 그래프에 쌓임 */
(function () {
  'use strict';
  var R = window.RSS, h = R.h;
  var EUR = 0.908584;   // 1 USD 당 유로 (2026-11-17)
  // 통화: code · 나라 이름 · 시대 · 기준값(1 LEVC 당) · 하루 변동성(%) · 요인 노출 · 스프레드(%)
  var CUR = [
    { code: 'MOON', ko: '루나시아', en: 'Lunaxia', era: 'old', base: 0.758255, vol: 0.55, f: { usd: 1, eur: 0.45 }, spr: 0.012 },
    { code: 'SOL', ko: '솔라리아', en: 'Solaria', era: 'old', base: 18273.21, vol: 0.5, f: { usd: 1, com: 0.5 }, spr: 0.06 },
    { code: 'IGN', ko: '인페르누스 공화국', en: 'Infernusria res publica', era: 'old', base: EUR * 40.3399, vol: 0.5, f: { usd: 1, eur: 1 }, idio: 0.35, spr: 0.02 },
    { code: 'RTC', ko: '레스렉시온', en: 'Resurrección', era: 'old', base: EUR * 166.386, vol: 0.5, f: { usd: 1, eur: 1 }, idio: 0.35, spr: 0.02 },
    { code: 'VEC', ko: '버믹쿠루시아', en: 'Vermiculucia', era: 'oldlev', base: EUR * 1.95583, vol: 0.48, f: { usd: 1, eur: 1 }, idio: 0.3, spr: 0.012 },
    { code: 'EOM', ko: '은월(銀月)', en: 'Eunwol', era: 'oldlev', base: 159.58, vol: 0.7, f: { usd: 1, risk: -0.8 }, spr: 0.015 },
    { code: 'SD', ko: '아스트랄리스', en: 'Astralis', era: 'oldlev', base: 124.097, vol: 0.75, f: { usd: 1, eur: 0.5 }, spr: 0.09 },
    { code: 'MEC', ko: '엘라렌', en: 'Ellaren', era: 'oldlev', base: 1.42937, vol: 0.45, f: { usd: 0.8, com: 0.8 }, spr: 0.015 },
    { code: 'CD', ko: '코르닉시아', en: 'Cornixia', era: 'oldlev', base: 3605.22, vol: 0.35, f: { usd: 1, com: 0.6 }, spr: 0.12, kappa: 0.002 },
    { code: 'DEM', ko: '추풍(秋楓)', en: 'Chupung', era: 'oldlev', base: 6.67926, vol: 0.22, f: { usd: 0.6, risk: 0.2 }, spr: 0.03, kappa: 0.006 },
    { code: 'OS', ko: '스텔마레', en: 'Stellmare', era: 'oldlev', base: EUR * 340.75, vol: 0.52, f: { usd: 1, eur: 1 }, idio: 0.4, spr: 0.025 },
    { code: 'COC', ko: '스텔루비아', en: 'Stelluvia', era: 'oldlev', base: 1.81695, vol: 0.75, f: { usd: 1, com: 1, risk: 0.6 }, spr: 0.02 },
    { code: 'IOD', ko: '글라시카에룰리아', en: 'Glacicaerulia', era: 'newlev', base: 6.78931, vol: 0.5, f: { usd: 1, eur: 0.95 }, idio: 0.45, spr: 0.04 },
    { code: 'PFD', ko: '겔루에테르누시아', en: 'Geluaeternucia', era: 'newlev', base: 6.78931, vol: 0.48, f: { usd: 1, eur: 0.98 }, idio: 0.3, spr: 0.025 }
  ];
  var ERAS = [
    { id: 'common', ko: '리바이어던 공용 화폐', en: 'Leviathan common currency' },
    { id: 'old', ko: '구세기', en: 'Old century' },
    { id: 'oldlev', ko: '구 리바이어던', en: 'Old Leviathan' },
    { id: 'newlev', ko: '신 리바이어던', en: 'New Leviathan' }
  ];
  // 화폐가 없는 나라 (목록에만 표시)
  var GONE = [
    { era: 'old', ko: '백월(白月)', en: 'Baekwol', why: ['멸망', 'Fallen'], after: 0 },
    { era: 'old', ko: '루벨리아', en: 'Rubelria', why: ['멸망', 'Fallen'], after: 2 },
    { era: 'old', ko: '비아레카트리아', en: 'Vialaecatria', why: ['아스트랄리스로 변경', 'Became Astralis'], after: 3 }
  ];
  CUR.forEach(function (c) { Object.defineProperty(c, 'name', { get: function () { return R.lang === 'en' ? c.en : c.ko; } }); });
  /* 기업 주가 (열람 전용): R.S.S. Mobile 과 같은 기업 · 시작 주가 · 변동 규칙. 각 앱이 따로 계산하므로 숫자는 휴대폰과 다름 */
  var STOCKS = [
    ['cg-pmc', '천공월아민간군사기업', 'VEC', 2480, 9, 1, '민간 군사'], ['ark', '아크 공방기업', 'VEC', 186.4, 2.2, 0, '공방 · 제작'], ['hongsaek', '홍색산업', 'VEC', 64.5, 1.8, 0, '중공업'], ['lhy-re', '이한영의 부동산', 'VEC', 92.3, 1.4, 0, '부동산'],
    ['rebelia', '레벨리아의 공방', 'RTC', 18400, 2.3, 0, '공방 · 제작'], ['core', 'C.O.R.E.', 'RTC', 412000, 9.5, 1, '첨단 기술'], ['linear', '선형은행', 'RTC', 9650, 1.3, 0, '금융'], ['makgang', '막강건설사', 'RTC', 6320, 2.0, 0, '건설'],
    ['sdp', 'STAR DEFENCE PROJECT', 'SD', 385000, 10, 1, '방위 산업'], ['starlight', '별빛 공방기업', 'SD', 21800, 2.2, 0, '공방 · 제작'], ['hwanseong', '환성감정소', 'SD', 14200, 1.6, 0, '감정 · 인증'], ['crown', 'C.R.O.W.N.', 'SD', 33500, 2.6, 0, '복합 기업'],
    ['osaek', '오색단풍', 'DEM', 18800, 9, 1, '복합 기업'], ['ken', '켄의 복사점', 'DEM', 42.6, 1.5, 0, '인쇄 · 복사'], ['dp-build', '단풍건설사', 'DEM', 88.4, 2.0, 0, '건설'], ['ryoko', '료코의 공방기업', 'DEM', 156, 2.1, 0, '공방 · 제작'],
    ['el-air', '엘 항공사', 'MEC', 1240, 9, 1, '항공'], ['seongmin', '성민물류', 'MEC', 46.8, 1.6, 0, '물류'], ['laos', '라오스무역', 'MEC', 2960, 9.5, 1, '무역'], ['ester', '에스터 공방기업', 'MEC', 112.5, 2.1, 0, '공방 · 제작'], ['hwanseo', '환서조선', 'MEC', 78.2, 2.2, 0, '조선'], ['grace', '그레이스 물류산업', 'MEC', 64.4, 1.7, 0, '물류'],
    ['memory', '메모리 디벨롭 스튜디오', 'EOM', 268000, 10, 1, '메모리 기술 개발'], ['moon-tour', '달 관광사', 'EOM', 4180, 1.9, 0, '관광'], ['wolgwang', '월광 공방기업', 'EOM', 12650, 2.2, 0, '공방 · 제작'], ['bloodyus', '블러디어스 공방기업', 'EOM', 9870, 2.4, 0, '공방 · 제작']
  ].map(function (a) { return { id: a[0], ko: a[1], nat: a[2], base: a[3], vol: a[4], risky: !!a[5], sec: a[6], stock: true }; });
  var NATS = {}; STOCKS.forEach(function (s) { NATS[s.nat] = { h: 1 }; });
  R.ECO = { CUR: CUR, ERAS: ERAS, GONE: GONE };

  /* ───────── 시장 엔진 ───────── */
  var TICK = 250, PER_CANDLE = 12, SPEED = 60, KEEP = 240;       // 0.25초마다 · 봉 하나 = 3초 · 시장 시간 60배 · 봉 240개 보관
  var tickVol = Math.sqrt(TICK / 1000 * SPEED / 86400);           // 하루 변동성 → 한 틱 변동성 비율
  var M = { started: false, t0: 0, ticks: 0, h: { usd: 1, eur: 1, com: 1, risk: 1 }, mood: 0, news: [], listeners: [] };
  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function init() {
    if (M.started) return;
    M.started = true; M.t0 = Date.now();
    CUR.concat(STOCKS).forEach(function (c) {
      c.x = Math.log(c.base); c.anchor = c.x; c.hv = 1; c.candles = []; c.open0 = c.base;
      c.cur = null; c.price = c.base;
    });
    // 창을 처음 열었을 때 그래프가 비어 있지 않게, 지난 봉 160개를 같은 규칙으로 미리 계산
    var back = 160 * PER_CANDLE;
    for (var i = 0; i < back; i++) step(Date.now() - (back - i) * TICK, true);
    CUR.concat(STOCKS).forEach(function (c) { c.open0 = c.candles.length ? c.candles[0].o : c.base; });
    setInterval(function () { step(Date.now(), false); }, TICK);
    scheduleNews();
  }

  function step(now, silent) {
    M.ticks++;
    // 공통 · 권역 요인: 변동성 뭉침(최근에 크게 움직였으면 다음에도 크게)
    var z = {};
    ['usd', 'eur', 'com', 'risk'].forEach(function (k) {
      var e = gauss();
      M.h[k] = Math.max(0.45, Math.min(4, 0.985 * M.h[k] + 0.015 * (0.6 + 0.4 * e * e) + 0.0));
      z[k] = e * Math.sqrt(M.h[k]);
    });
    M.mood = 0.995 * M.mood + 0.005 * z.risk;                       // 시장 분위기 (+ 위험 회피 ↔ − 위험 선호)
    CUR.forEach(function (c) {
      var e = gauss();
      c.hv = Math.max(0.45, Math.min(5, 0.97 * c.hv + 0.03 * (0.5 + 0.5 * e * e)));
      var f = c.f, idio = c.idio || 0.5;
      var common = (f.usd || 0) * 0.55 * z.usd + (f.eur || 0) * 0.6 * z.eur + (f.com || 0) * 0.5 * z.com + (f.risk || 0) * 0.5 * z.risk;
      var shock = c.vol / 100 * tickVol * (common + idio * e * Math.sqrt(c.hv));
      var pull = -(c.kappa || 0.0006) * (c.x - c.anchor);           // 기준값으로 천천히 돌아오는 힘
      if (c.jump) { shock += c.jump / 6; c.jump *= 5 / 6; if (Math.abs(c.jump) < 1e-6) c.jump = 0; }
      c.x += shock + pull;
      var p = Math.exp(c.x);
      // 봉 만들기: 12틱(3초)마다 새 봉
      if (!c.cur || c.cur.n >= PER_CANDLE) {
        if (c.cur) { c.candles.push(c.cur); if (c.candles.length > KEEP) c.candles.shift(); }
        c.cur = { t: now, o: p, h: p, l: p, c: p, n: 0 };
      }
      var k = c.cur; k.h = Math.max(k.h, p); k.l = Math.min(k.l, p); k.c = p; k.n++;
      c.price = p;
    });
    // 기업 주가: 나라 경기 요인 + 기업마다 다른 변동성 (고위험 기업은 가끔 크게 오르내림)
    var zn = {};
    Object.keys(NATS).forEach(function (n) { var e = gauss(); NATS[n].h = Math.max(0.5, Math.min(4, 0.98 * NATS[n].h + 0.02 * (0.6 + 0.4 * e * e))); zn[n] = e * Math.sqrt(NATS[n].h); });
    STOCKS.forEach(function (c) {
      var e = gauss();
      c.hv = Math.max(0.45, Math.min(6, 0.97 * c.hv + 0.03 * (0.5 + 0.5 * e * e)));
      var shock = c.vol / 100 * tickVol * (0.45 * zn[c.nat] + 0.85 * e * Math.sqrt(c.hv));
      if (c.risky && Math.random() < 0.0009) { c.jump = (c.jump || 0) + (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.06); c.hv = Math.min(6, c.hv + 2.5); }
      if (c.jump) { shock += c.jump / 5; c.jump *= 4 / 5; if (Math.abs(c.jump) < 1e-5) c.jump = 0; }
      c.x += shock - 0.00004 * (c.x - c.anchor);
      var p = Math.exp(c.x);
      if (!c.cur || c.cur.n >= PER_CANDLE) { if (c.cur) { c.candles.push(c.cur); if (c.candles.length > KEEP) c.candles.shift(); } c.cur = { t: now, o: p, h: p, l: p, c: p, n: 0 }; }
      var k = c.cur; k.h = Math.max(k.h, p); k.l = Math.min(k.l, p); k.c = p; k.n++;
      c.price = p;
    });
    if (!silent) M.listeners.forEach(function (fn) { fn(); });
  }

  /* LEVC 지수: 모든 통화 대비 LEVC 의 강세 (처음 = 100, 오르면 LEVC 강세) */
  function levcIndex(at) {
    var s = 0;
    CUR.forEach(function (c) { var p = at === 'open' ? c.open0 : c.price; s += Math.log(p / c.base); });
    return 100 * Math.exp(s / CUR.length);
  }

  /* 경제 소식: 20~50초마다 하나. 해당 통화가 조금 크게 움직이고 변동성이 잠시 커짐 */
  var NEWS = [
    { ko: '{n} 중앙은행, 기준금리 0.25%p 인상', en: '{n} central bank raises rates by 25bp', s: 1, m: 6 },
    { ko: '{n} 중앙은행, 기준금리 0.25%p 인하', en: '{n} central bank cuts rates by 25bp', s: -1, m: 6 },
    { ko: '{n} 무역수지 흑자 폭 확대', en: '{n} trade surplus widens', s: 1, m: 4 },
    { ko: '{n} 무역수지 적자 전환', en: '{n} trade balance turns to deficit', s: -1, m: 4 },
    { ko: '{n} 물가 상승률 예상치 상회', en: '{n} inflation tops forecasts', s: -1, m: 3 },
    { ko: '{n} 성장률 전망 상향 조정', en: '{n} growth outlook revised up', s: 1, m: 3 },
    { ko: '{n} 성장률 전망 하향 조정', en: '{n} growth outlook revised down', s: -1, m: 3 },
    { ko: '{n} 국채 금리 급등', en: '{n} bond yields jump', s: 1, m: 3 },
    { ko: '{n} 외환보유액 감소 발표', en: '{n} reports falling FX reserves', s: -1, m: 5 }
  ];
  var BLOC = [
    { ko: '리바이어던 공용 화폐 수요 급증', en: 'Demand for LEVC surges', all: 1, m: 3 },
    { ko: '리바이어던 공용 화폐 약세 압력', en: 'LEVC under selling pressure', all: -1, m: 3 },
    { ko: '원자재 가격 급등 · 자원국 통화 강세', en: 'Commodities rally · resource currencies firm', key: 'com', m: 4 },
    { ko: '위험 회피 심리 확산 · 은월 강세', en: 'Risk-off spreads · Eunwol firms', key: 'risk', m: 4 }
  ];
  function scheduleNews() { setTimeout(function () { news(); scheduleNews(); }, 20000 + Math.random() * 30000); }
  function news() {
    var item, hit = [];
    if (Math.random() < 0.25) {
      var b = BLOC[(Math.random() * BLOC.length) | 0];
      CUR.forEach(function (c) {
        var dir = b.all ? b.all : (b.key === 'risk' ? -(c.f.risk || 0) : (c.f[b.key] || 0));
        if (!dir) return;
        // 통화가 강해지면(dir>0) 1 LEVC 당 숫자는 내려감. LEVC 자체가 강해지면(all>0) 숫자는 올라감
        var sign = b.all ? 1 : -1;
        c.jump = (c.jump || 0) + sign * dir * b.m * c.vol / 100 * tickVol * 3; c.hv = Math.min(5, c.hv + 1.2); hit.push(c.code);
      });
      item = { t: Date.now(), ko: b.ko, en: b.en, codes: hit, dir: b.all ? -b.all : 1 };
    } else {
      var c = CUR[(Math.random() * CUR.length) | 0], n = NEWS[(Math.random() * NEWS.length) | 0];
      c.jump = (c.jump || 0) - n.s * n.m * c.vol / 100 * tickVol * 4; c.hv = Math.min(5, c.hv + 2);
      item = { t: Date.now(), ko: n.ko.replace('{n}', c.ko), en: n.en.replace('{n}', c.en), codes: [c.code], dir: n.s };
    }
    M.news.unshift(item); if (M.news.length > 30) M.news.pop();
  }

  /* ───────── 표시 도우미 ───────── */
  function dec(v) { return v >= 1000 ? 2 : v >= 100 ? 3 : v >= 10 ? 4 : 5; }
  var nf = {};
  function fmt(v, d) { d = d == null ? dec(v) : d; var k = d; nf[k] = nf[k] || new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); return nf[k].format(v); }
  function pct(a, b) { return (a / b - 1) * 100; }
  // 통화 가치 변동: 1 LEVC 당 숫자가 내려가면 그 통화가 강해진 것(+)
  function strength(c) { return -pct(c.price, c.open0); }
  function sgn(v, d) { d = d == null ? 3 : d; var r = +v.toFixed(d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d) + '%'; }   // 반올림해서 0 이면 부호 없음
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  function hms(t) { var d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }

  function sizeCanvas(cv) {
    var r = cv.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(10, Math.round(r.width * k)), hh = Math.max(10, Math.round(r.height * k));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    return { w: w, h: hh, k: k };
  }
  var COL = { up: '#FFB020', down: '#E0412B', grid: 'rgba(255,176,32,.10)', axis: '#A69B84', text: '#F3E8D2', ma: 'rgba(243,232,210,.55)', bg: '#07080A' };

  function sparkline(cv, c) {
    var s = sizeCanvas(cv), g = cv.getContext('2d'), pts = c.candles.slice(-48).map(function (k) { return k.c; }).concat([c.price]);
    g.clearRect(0, 0, s.w, s.h);
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), rg = hi - lo || hi * 1e-6;
    g.lineWidth = 1.2 * s.k; g.strokeStyle = (c.stockUp != null ? c.stockUp : strength(c) >= 0) ? COL.up : COL.down; g.beginPath();
    pts.forEach(function (v, i) { var x = i / (pts.length - 1) * (s.w - 2) + 1, y = s.h - 2 - (v - lo) / rg * (s.h - 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }

  /* 큰 그래프: 3초 봉(캔들) + 20봉 이동평균 + 현재가 선 · 마우스를 올리면 그 봉의 시가/고가/저가/종가 */
  function drawChart(cv, c, mode, hover) {
    var stock = !!c.stock;   // 주가: 오른 봉 = 주황 (환율은 숫자가 내려간 봉 = 그 화폐 강세 = 주황)
    var s = sizeCanvas(cv), g = cv.getContext('2d'), k = s.k;
    var padR = 78 * k, padB = 22 * k, padT = 10 * k, W = s.w - padR, Hh = s.h - padB - padT;
    var cw = 8 * k, n = Math.max(10, Math.floor(W / cw)), list = c.candles.slice(-(n - 1)).concat([c.cur]);
    g.fillStyle = COL.bg; g.fillRect(0, 0, s.w, s.h);
    var lo = Infinity, hi = -Infinity;
    list.forEach(function (q) { lo = Math.min(lo, q.l); hi = Math.max(hi, q.h); });
    var pad = (hi - lo) * 0.12 || hi * 1e-5; lo -= pad; hi += pad;
    var Y = function (v) { return padT + (hi - v) / (hi - lo) * Hh; };
    // 눈금
    g.font = (10 * k) + 'px D2Coding, monospace'; g.textBaseline = 'middle'; g.lineWidth = 1;
    for (var i = 0; i <= 5; i++) {
      var v = lo + (hi - lo) * i / 5, y = Math.round(Y(v)) + 0.5;
      g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      g.fillStyle = COL.axis; g.fillText(fmt(v), W + 8 * k, y);
    }
    g.textBaseline = 'top';
    var x0 = W - list.length * cw;
    list.forEach(function (q, i) {
      var x = x0 + i * cw + cw / 2;
      if (i % 12 === 0 && x > 30 * k) { g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(Math.round(x) + 0.5, padT); g.lineTo(Math.round(x) + 0.5, padT + Hh); g.stroke(); g.fillStyle = COL.axis; g.fillText(hms(q.t), x - 22 * k, padT + Hh + 6 * k); }
    });
    if (mode === 'line') {
      g.strokeStyle = COL.up; g.lineWidth = 1.6 * k; g.beginPath();
      list.forEach(function (q, i) { var x = x0 + i * cw + cw / 2, y = Y(q.c); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
      g.lineTo(x0 + (list.length - 1) * cw + cw / 2, padT + Hh); g.lineTo(x0 + cw / 2, padT + Hh); g.closePath();
      var gr = g.createLinearGradient(0, padT, 0, padT + Hh); gr.addColorStop(0, 'rgba(255,176,32,.18)'); gr.addColorStop(1, 'rgba(255,176,32,0)');
      g.fillStyle = gr; g.fill();
    } else {
      list.forEach(function (q, i) {
        // 숫자가 내려간 봉 = 그 통화가 강해진 봉 → 주황, 올라간 봉 = 약해진 봉 → 빨강
        var x = x0 + i * cw, up = stock ? q.c >= q.o : q.c <= q.o, col = up ? COL.up : COL.down;
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, k);
        var cx = Math.round(x + cw / 2) + 0.5; g.beginPath(); g.moveTo(cx, Y(q.h)); g.lineTo(cx, Y(q.l)); g.stroke();
        var yo = Y(q.o), yc = Y(q.c), top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
        if (up) g.fillRect(x + 1.5 * k, top, cw - 3 * k, bh); else { g.fillStyle = COL.bg; g.fillRect(x + 1.5 * k, top, cw - 3 * k, bh); g.strokeRect(x + 1.5 * k + 0.5, top + 0.5, cw - 3 * k - 1, bh - 1); }
      });
    }
    // 20봉 이동평균
    g.strokeStyle = COL.ma; g.lineWidth = k; g.setLineDash([3 * k, 3 * k]); g.beginPath();
    var started = false;
    list.forEach(function (q, i) {
      var all = c.candles.concat([c.cur]), idx = all.length - list.length + i; if (idx < 19) return;
      var m = 0; for (var j = idx - 19; j <= idx; j++) m += all[j].c; m /= 20;
      var x = x0 + i * cw + cw / 2, y = Y(m); if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; }
    });
    g.stroke(); g.setLineDash([]);
    // 현재가
    var yp = Math.round(Y(c.price)) + 0.5;
    g.strokeStyle = 'rgba(255,176,32,.5)'; g.setLineDash([2 * k, 4 * k]); g.beginPath(); g.moveTo(0, yp); g.lineTo(W, yp); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.up; g.fillRect(W + 2 * k, yp - 9 * k, padR - 4 * k, 18 * k);
    g.fillStyle = '#1A1206'; g.textBaseline = 'middle'; g.font = '700 ' + (10 * k) + 'px D2Coding, monospace'; g.fillText(fmt(c.price), W + 6 * k, yp);
    // 마우스 위치의 봉
    if (hover != null) {
      var hi2 = Math.floor((hover * k - x0) / cw);
      if (hi2 >= 0 && hi2 < list.length) {
        var q = list[hi2], hx = Math.round(x0 + hi2 * cw + cw / 2) + 0.5;
        g.strokeStyle = 'rgba(243,232,210,.35)'; g.beginPath(); g.moveTo(hx, padT); g.lineTo(hx, padT + Hh); g.stroke();
        return q;
      }
    }
    return null;
  }

  /* ───────── 화면 ───────── */
  var sel = 'MOON', mode = 'candle';
  R.views.economy = function (root, opts) {
    init();
    if (opts && opts.code) sel = opts.code;
    var T = R.T;
    var idxEl = h('b'), idxCh = h('span'), moodEl = h('b'), breadth = h('b'), clockEl = h('b');
    var top = h('div', { class: 'eco-top' },
      h('div', null, h('span', null, T('LEVC 지수', 'LEVC index')), idxEl, idxCh),
      h('div', null, h('span', null, T('시장 분위기', 'Market mood')), moodEl),
      h('div', null, h('span', null, T('강세 · 약세 통화', 'Up · down')), breadth),
      h('div', null, h('span', null, T('시장 시각 · 60배속', 'Market clock · ×60')), clockEl));
    var list = h('div', { class: 'eco-list' });
    var rows = {};
    ERAS.forEach(function (era) {
      list.appendChild(h('div', { class: 'eco-era' }, T(era.ko, era.en)));
      if (era.id === 'common') {
        var b = h('button', { class: 'eco-row base' + (sel === 'LEVC' ? ' on' : ''), type: 'button', onclick: function () { pick('LEVC'); } },
          h('span', { class: 'eco-n' }, T('리바이어던 공용 화폐', 'Leviathan Common Currency'), h('em', null, 'LEVC')),
          h('span', { class: 'eco-v' }, '1.00000'), h('span', { class: 'eco-c' }, T('기준', 'BASE')));
        rows.LEVC = { el: b }; list.appendChild(b); return;
      }
      var items = CUR.filter(function (c) { return c.era === era.id; });
      var gone = GONE.filter(function (g) { return g.era === era.id; });
      var out = [];
      items.forEach(function (c, i) { gone.filter(function (g) { return g.after === i; }).forEach(function (g) { out.push(g); }); out.push(c); });
      gone.filter(function (g) { return g.after >= items.length; }).forEach(function (g) { out.push(g); });
      out.forEach(function (c) {
        if (!c.code) { list.appendChild(h('div', { class: 'eco-row gone' }, h('span', { class: 'eco-n' }, T(c.ko, c.en)), h('span', { class: 'eco-v' }, T(c.why[0], c.why[1])), h('span', { class: 'eco-c' }, T('화폐 없음', 'No currency')))); return; }
        var v = h('span', { class: 'eco-v' }), ch = h('span', { class: 'eco-c' }), sp = h('canvas', { class: 'eco-sp' });
        var b2 = h('button', { class: 'eco-row' + (sel === c.code ? ' on' : ''), type: 'button', onclick: function () { pick(c.code); } },
          h('span', { class: 'eco-n' }, c.name, h('em', null, c.code)), sp, v, ch);
        rows[c.code] = { el: b2, v: v, ch: ch, sp: sp };
        list.appendChild(b2);
      });
    });

    // 오른쪽: 고른 통화
    var hName = h('h3'), hCode = h('span', { class: 'eco-code' }), hPrice = h('div', { class: 'eco-price' }), hCh = h('div', { class: 'eco-pch' });
    var stats = h('div', { class: 'eco-stats' });
    var cv = h('canvas', { class: 'eco-chart' }), tip = h('div', { class: 'eco-tip', hidden: true });
    var modeBtn = h('div', { class: 'tabs' },
      h('button', { class: 'tab' + (mode === 'candle' ? ' on' : ''), type: 'button', onclick: function () { setMode('candle'); } }, T('봉 그래프', 'Candles')),
      h('button', { class: 'tab' + (mode === 'line' ? ' on' : ''), type: 'button', onclick: function () { setMode('line'); } }, T('선 그래프', 'Line')));
    var note = h('div', { class: 'eco-note' }, T('1 LEVC 당 환율 · 봉 하나 = 3초 · 점선 = 20봉 이동평균 · 숫자가 내려가면 그 화폐의 가치가 오른 것', 'Units per 1 LEVC · one candle = 3 s · dashed = 20-candle MA · a falling number means the currency gained value'));
    // 환전 계산
    var amt = h('input', { class: 'input', type: 'number', value: '1000', min: '0', step: 'any' });
    var codes = ['LEVC'].concat(CUR.map(function (c) { return c.code; }));
    var mk = function (v) { return h('select', { class: 'select' }, codes.map(function (cd) { var o = h('option', { value: cd }, cd + ' · ' + (cd === 'LEVC' ? T('리바이어던 공용', 'Leviathan') : CUR.filter(function (c) { return c.code === cd; })[0].name)); if (cd === v) o.selected = true; return o; })); };
    var from = mk('LEVC'), to = mk(sel === 'LEVC' ? 'MOON' : sel), res = h('div', { class: 'eco-res' });
    var swap = h('button', { class: 'btn', type: 'button', onclick: function () { var a = from.value; from.value = to.value; to.value = a; conv(); } }, '⇄');
    [amt, from, to].forEach(function (x) { x.addEventListener('input', conv); x.addEventListener('change', conv); });
    var newsEl = h('div', { class: 'eco-news' });
    var coBox = h('div', { class: 'eco-cos' }), coHead = h('h4'), coCard = h('div', { class: 'eco-card eco-co-card' }, coHead, coBox), selCo = null, coRows = {};
    var movers = h('div', { class: 'eco-movers' });

    var main = h('section', { class: 'eco-main' },
      h('div', { class: 'eco-head' }, h('div', null, hName, hCode), h('div', { class: 'eco-q' }, hPrice, hCh)),
      stats,
      coCard,
      h('div', { class: 'eco-chart-wrap' }, h('div', { class: 'eco-chart-tools' }, modeBtn, note), h('div', { class: 'eco-chart-box' }, cv, tip)),
      h('div', { class: 'eco-bottom' },
        h('div', { class: 'eco-card' }, h('h4', null, T('환전 계산', 'Converter')), h('div', { class: 'eco-conv' }, amt, from, swap, to), res),
        h('div', { class: 'eco-card' }, h('h4', null, T('오늘의 흐름', 'Movers')), movers),
        h('div', { class: 'eco-card eco-card-news' }, h('h4', null, T('경제 소식', 'Market news')), newsEl)));
    root.appendChild(h('div', { class: 'eco' }, top, h('div', { class: 'eco-body' }, h('section', { class: 'eco-side' }, list), main)));

    var hover = null;
    cv.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); hover = e.clientX - r.left; draw(); });
    cv.addEventListener('pointerleave', function () { hover = null; tip.hidden = true; draw(); });

    function cur() { return sel === 'LEVC' ? null : CUR.filter(function (c) { return c.code === sel; })[0]; }
    /* 나라를 고르면 그 나라 기업 목록 · 기업을 누르면 그 기업 주가 그래프 */
    function drawCos() {
      coBox.innerHTML = ''; coRows = {};
      var list = STOCKS.filter(function (s) { return s.nat === sel; });
      coCard.hidden = !list.length;
      if (!list.length) return;
      var nat = CUR.filter(function (x) { return x.code === sel; })[0];
      coHead.textContent = '';
      coHead.appendChild(document.createTextNode(T(nat.ko + ' 기업 주가 · 열람 전용', nat.en + ' stocks · view only')));
      if (selCo) coHead.appendChild(h('button', { class: 'eco-back', type: 'button', onclick: function () { selCo = null; R.sound.nav(); drawCos(); draw(true); } }, T('‹ 환율 그래프로', '‹ Back to FX')));
      list.forEach(function (s) {
        var pr = h('span', { class: 'eco-cv' }), ch = h('span', { class: 'eco-cc' }), sp = h('canvas', { class: 'eco-csp' });
        var b = h('button', { class: 'eco-co' + (selCo === s ? ' on' : '') + (s.risky ? ' risky' : ''), type: 'button', onclick: function () { selCo = selCo === s ? null : s; R.sound.nav(); drawCos(); draw(true); } },
          h('span', { class: 'eco-cn' }, s.ko, h('em', null, (s.risky ? T('고위험 · ', 'High risk · ') : '') + s.sec)), sp, pr, ch);
        coRows[s.id] = { pr: pr, ch: ch, sp: sp, s: s };
        coBox.appendChild(b);
      });
    }
    function pick(code) {
      sel = code; selCo = null; R.sound.nav(); drawCos();
      Object.keys(rows).forEach(function (k) { rows[k].el.classList.toggle('on', k === sel); });
      if (code !== 'LEVC') { to.value = code; conv(); }
      draw(true);
    }
    function setMode(m) { mode = m; modeBtn.children[0].classList.toggle('on', m === 'candle'); modeBtn.children[1].classList.toggle('on', m === 'line'); draw(); }
    function rate(code) { return code === 'LEVC' ? 1 : CUR.filter(function (c) { return c.code === code; })[0].price; }
    function conv() {
      var a = parseFloat(amt.value) || 0, r = rate(to.value) / rate(from.value), v = a * r;
      res.textContent = '';
      res.appendChild(h('b', null, fmt(v, v >= 1000 ? 2 : 4) + ' ' + to.value));
      res.appendChild(h('span', null, '1 ' + from.value + ' = ' + fmt(r) + ' ' + to.value));
    }
    var lastCandle = -1;
    function draw(full) {
      var c = cur(), ix = levcIndex(), ix0 = levcIndex('open');
      idxEl.textContent = ix.toFixed(3); idxCh.textContent = ' ' + sgn(pct(ix, ix0)); idxCh.className = ix >= ix0 ? 'up' : 'down';
      moodEl.textContent = M.mood > 0.12 ? T('위험 회피', 'Risk-off') : M.mood < -0.12 ? T('위험 선호', 'Risk-on') : T('관망', 'Neutral');   // 위험 요인이 + 면 회피 (은월 강세 · 스텔루비아 약세)
      var ups = CUR.filter(function (x) { return strength(x) > 0; }).length; breadth.textContent = ups + ' · ' + (CUR.length - ups);
      clockEl.textContent = (function () { var m = (Date.now() - M.t0) / 1000 * SPEED / 60 + 9 * 60, hh = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return p2(hh) + ':' + p2(mm); })();
      var newCandle = CUR[0].candles.length + ':' + CUR[0].candles[CUR[0].candles.length - 1].t;
      CUR.forEach(function (x) {
        var r = rows[x.code]; if (!r) return;
        r.v.textContent = fmt(x.price);
        var st = strength(x); r.ch.textContent = sgn(st); r.ch.className = 'eco-c ' + (st >= 0 ? 'up' : 'down');
        if (full || newCandle !== lastCandle) sparkline(r.sp, x);
      });
      Object.keys(coRows).forEach(function (k) {
        var r = coRows[k], s = r.s, chg = (s.price / s.open0 - 1) * 100;
        r.pr.textContent = fmt(s.price) + ' ' + s.nat; r.ch.textContent = sgn(chg, 2); r.ch.className = 'eco-cc ' + (chg >= 0 ? 'up' : 'down');
        if (full || newCandle !== lastCandle) sparkline(r.sp, { candles: s.candles, price: s.price, base: s.base, open0: s.open0, stockUp: chg >= 0 });
      });
      lastCandle = newCandle;
      // 그래프 설명: 주가인지 환율인지에 맞게
      note.textContent = selCo ? T('주가 (' + selCo.nat + ') · 봉 하나 = 3초 · 점선 = 20봉 이동평균 · 오른 봉은 주황, 내린 봉은 빨강 · 거래는 R.S.S. Mobile 에서', 'Price in ' + selCo.nat + ' · one candle = 3 s · dashed = 20-candle MA · trade in R.S.S. Mobile')
        : T('1 LEVC 당 환율 · 봉 하나 = 3초 · 점선 = 20봉 이동평균 · 숫자가 내려가면 그 화폐의 가치가 오른 것', 'Units per 1 LEVC · one candle = 3 s · dashed = 20-candle MA · a falling number means the currency gained value');
      // 고른 기업
      if (selCo) {
        var s = selCo, chg = (s.price / s.open0 - 1) * 100, allc = s.candles.concat([s.cur]), shi = -Infinity, slo = Infinity;
        allc.forEach(function (q) { shi = Math.max(shi, q.h); slo = Math.min(slo, q.l); });
        hName.textContent = s.ko; hCode.textContent = s.sec + ' · ' + c.name + ' · ' + s.nat + (s.risky ? T(' · 고위험', ' · high risk') : '');
        hPrice.textContent = fmt(s.price) + ' ' + s.nat; hCh.textContent = sgn(chg, 2) + '  ·  ≈ ' + fmt(s.price / c.price) + ' LEVC'; hCh.className = 'eco-pch ' + (chg >= 0 ? 'up' : 'down');
        stats.innerHTML = '';
        [[T('시가', 'Open'), fmt(s.open0)], [T('고가', 'High'), fmt(shi)], [T('저가', 'Low'), fmt(slo)], [T('LEVC 환산', 'In LEVC'), fmt(s.price / c.price)],
          [T('변동성', 'Volatility'), s.hv > 2 ? T('높음', 'High') : s.hv > 1.2 ? T('보통', 'Normal') : T('안정', 'Calm')], [T('거래', 'Trading'), T('R.S.S. Mobile 에서', 'In R.S.S. Mobile')]]
          .forEach(function (x) { stats.appendChild(stat(x[0], x[1])); });
        var qs = drawChart(cv, s, mode, hover);
        if (qs) { tip.hidden = false; tip.textContent = hms(qs.t) + '   O ' + fmt(qs.o) + '   H ' + fmt(qs.h) + '   L ' + fmt(qs.l) + '   C ' + fmt(qs.c); } else tip.hidden = true;
      }
      // 고른 통화
      else if (!c) {
        hName.textContent = T('리바이어던 공용 화폐', 'Leviathan Common Currency'); hCode.textContent = 'LEVC · ' + T('기준 통화', 'base currency');
        hPrice.textContent = ix.toFixed(3); hCh.textContent = T('LEVC 지수 ', 'LEVC index ') + sgn(pct(ix, ix0)); hCh.className = 'eco-pch ' + (ix >= ix0 ? 'up' : 'down');
        stats.innerHTML = ''; stats.appendChild(stat(T('의미', 'Meaning'), T('모든 화폐 대비 LEVC 의 강약 (처음 = 100)', 'LEVC strength vs all currencies (start = 100)')));
        drawIndex();
      } else {
        hName.textContent = c.name; hCode.textContent = c.code + ' · ' + T(ERAS.filter(function (e) { return e.id === c.era; })[0].ko, ERAS.filter(function (e) { return e.id === c.era; })[0].en);
        var st2 = strength(c);
        hPrice.textContent = fmt(c.price); hCh.textContent = T('가치 ', 'Value ') + sgn(st2) + '  ·  1 LEVC = ' + fmt(c.price) + ' ' + c.code; hCh.className = 'eco-pch ' + (st2 >= 0 ? 'up' : 'down');
        var all = c.candles.concat([c.cur]), hi = -Infinity, lo = Infinity; all.forEach(function (q) { hi = Math.max(hi, q.h); lo = Math.min(lo, q.l); });
        var half = c.price * c.spr / 200;
        stats.innerHTML = '';
        [[T('매수(Bid)', 'Bid'), fmt(c.price - half)], [T('매도(Ask)', 'Ask'), fmt(c.price + half)], [T('시가', 'Open'), fmt(c.open0)], [T('고가', 'High'), fmt(hi)], [T('저가', 'Low'), fmt(lo)],
          [T('변동성', 'Volatility'), c.hv > 2 ? T('높음', 'High') : c.hv > 1.2 ? T('보통', 'Normal') : T('안정', 'Calm')], [T('1 ' + c.code + ' =', '1 ' + c.code + ' ='), fmt(1 / c.price, 1 / c.price < 0.01 ? 7 : 5) + ' LEVC']]
          .forEach(function (s) { stats.appendChild(stat(s[0], s[1])); });
        var q = drawChart(cv, c, mode, hover);
        if (q) { tip.hidden = false; tip.textContent = hms(q.t) + '   O ' + fmt(q.o) + '   H ' + fmt(q.h) + '   L ' + fmt(q.l) + '   C ' + fmt(q.c); }
        else tip.hidden = true;
      }
      // 흐름 · 소식
      var sorted = CUR.slice().sort(function (a, b) { return strength(b) - strength(a); });
      movers.innerHTML = '';
      sorted.slice(0, 3).concat(sorted.slice(-3)).forEach(function (x, i) {
        var st = strength(x);
        movers.appendChild(h('div', { class: 'eco-mv' }, h('span', null, i < 3 ? '▲' : '▼'), h('b', null, x.code), h('span', { class: 'n' }, x.name), h('span', { class: st >= 0 ? 'up' : 'down' }, sgn(st))));
      });
      if (newsEl.dataset.n !== String(M.news.length ? M.news[0].t : 0)) {
        newsEl.dataset.n = String(M.news.length ? M.news[0].t : 0); newsEl.innerHTML = '';
        if (!M.news.length) newsEl.appendChild(h('div', { class: 'eco-empty' }, T('아직 소식이 없습니다. 장이 열려 있습니다.', 'No news yet. Market is open.')));
        M.news.slice(0, 8).forEach(function (n) {
          newsEl.appendChild(h('div', { class: 'eco-nw' }, h('span', { class: 't' }, hms(n.t)), h('span', { class: 'm' }, T(n.ko, n.en)), h('span', { class: 'c ' + (n.dir > 0 ? 'up' : 'down') }, n.codes.slice(0, 4).join(' ') + (n.codes.length > 4 ? ' …' : ''))));
        });
      }
      conv();
    }
    function stat(k, v) { return h('div', null, h('span', null, k), h('b', null, v)); }
    // LEVC 를 고르면: LEVC 지수 선 그래프
    function drawIndex() {
      var s = sizeCanvas(cv), g = cv.getContext('2d'), k = s.k, n = CUR[0].candles.length, pts = [];
      for (var i = 0; i < n; i++) { var sum = 0; CUR.forEach(function (c) { sum += Math.log(c.candles[i] ? c.candles[i].c / c.base : 1); }); pts.push(100 * Math.exp(sum / CUR.length)); }
      pts.push(levcIndex());
      var fake = { candles: pts.slice(0, -1).map(function (v, i) { return { t: CUR[0].candles[i].t, o: v, h: v, l: v, c: v }; }), cur: { t: Date.now(), o: pts[pts.length - 1], h: pts[pts.length - 1], l: pts[pts.length - 1], c: pts[pts.length - 1] }, price: pts[pts.length - 1] };
      drawChart(cv, fake, 'line', null);
      void g; void k; tip.hidden = true;
    }
    var off = function () { draw(); };
    M.listeners.push(off);
    var ro = new ResizeObserver(function () { draw(true); }); ro.observe(cv); ro.observe(list);
    drawCos();
    setTimeout(function () { draw(true); }, 30);
    R.log('SYS', T('경제 현황 연결 · 환율 ', 'Economy linked · ') + CUR.length + T('종', ' currencies'));
    return function () { M.listeners = M.listeners.filter(function (f) { return f !== off; }); ro.disconnect(); };
  };

  /* 대화창에서 쓰는 조회 (예: "SOL 환율") */
  R.eco = {
    start: init,
    find: function (t) {
      var s = String(t || '').toLowerCase();
      return CUR.filter(function (c) { return new RegExp('(^|[^a-z])' + c.code.toLowerCase() + '([^a-z]|$)').test(s) || s.indexOf(c.ko.replace(/\(.*\)/, '').toLowerCase()) >= 0 || s.indexOf(c.en.toLowerCase()) >= 0; })[0] || null;
    },
    quote: function (c) { init(); return { price: c.price, text: fmt(c.price), strength: sgn(strength(c)), up: strength(c) >= 0 }; }
  };
})();
