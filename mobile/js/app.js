/* R.S.S. Mobile: 잠금(접속 코드) → R.S.S. Mobile Simulation → 지갑 · 시장 · 일하기 · 기록
   - 처음 들어오면 지갑에 50,000,000 LEVC 지급
   - 기업 주식은 그 나라 화폐로 거래되고, LEVC 는 그 순간의 환율로 바뀌어 계산됨
   - 이 투자는 시뮬레이션: R.S.S. 데스크톱 시스템에는 아무 영향이 없음 */
(function () {
  'use strict';
  var M = window.RSSM, h = M.h, $ = M.$, K = M.market, S = M.store;
  var GRANT = 50000000, MIN = 4, MAX = 8;
  var app = $('#app');

  /* ───────── 잠금 화면 (앱을 열 때마다 처음부터) ───────── */
  function lock() {
    var create = !S.exists(), first = '', buf = '', fails = 0, until = 0, busy = false;
    app.innerHTML = '';
    var slots = h('div', { class: 'slots' }), status = h('div', { class: 'lk-status' }), pad = h('div', { class: 'pad' });
    var root = h('section', { class: 'lock' },
      h('div', { class: 'lk-em', html: window.RSSEmblem.svg({ color: '#FFB020' }) }),
      h('div', { class: 'lk-word' }, 'R.S.S.', h('small', null, 'MOBILE')),
      h('div', { class: 'lk-sub' }, 'SECURE TERMINAL · SIMULATION LINK'),
      slots, status, pad);
    app.appendChild(root);
    '123456789'.split('').concat(['CLR', '0', 'DEL']).forEach(function (k) { pad.appendChild(h('button', { class: 'key' + (/\d/.test(k) ? '' : ' fn'), type: 'button', 'data-k': k }, k)); });
    pad.appendChild(h('button', { class: 'key ok', type: 'button', 'data-k': 'OK' }, 'AUTHENTICATE'));
    pad.addEventListener('click', function (e) { var b = e.target.closest('.key'); if (b) press(b.getAttribute('data-k'), b); });
    function draw() {
      slots.innerHTML = '';
      for (var i = 0; i < MAX; i++) slots.appendChild(h('div', { class: 'slot' + (i < buf.length ? ' on' : i === buf.length ? ' cur' : '') + (i >= MIN && i >= buf.length ? ' off' : '') }, i < buf.length ? '*' : ''));
    }
    function say(t, deny) { status.classList.toggle('deny', !!deny); M.decode(status, t); }
    function press(k, b) {
      if (busy || Date.now() < until) return;
      b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 110);
      if (/\d/.test(k)) { if (buf.length >= MAX) return; buf += k; M.sound.key(); }
      else if (k === 'DEL') { if (!buf) return; buf = buf.slice(0, -1); M.sound.key(); }
      else if (k === 'CLR') { if (!buf) return; buf = ''; M.sound.key(); }
      else if (k === 'OK') return submit();
      draw();
    }
    function submit() {
      if (buf.length < MIN) { M.sound.deny(); return say('접속 코드는 숫자 ' + MIN + '~' + MAX + '자리입니다', true); }
      if (create) {
        if (!first) { first = buf; buf = ''; draw(); M.sound.tap(); return say('같은 코드를 한 번 더 입력하십시오'); }
        if (buf !== first) { first = ''; buf = ''; draw(); M.sound.deny(); return say('코드가 서로 다릅니다. 처음부터 다시 입력하십시오', true); }
        busy = true; say('보관소 생성 중');
        return S.create(buf, fresh()).then(function () { M.sound.ok(); enter(true); });
      }
      busy = true; say('인증 중');
      S.unlock(buf).then(function () { M.sound.ok(); enter(false); }, function () {
        busy = false; buf = ''; draw(); fails++; M.sound.deny();
        if (fails >= 5) { until = Date.now() + 30000; fails = 0; say('5회 실패 · 30초 동안 입력이 잠깁니다', true); }
        else say('접속 코드가 맞지 않습니다 (' + fails + '/5)', true);
      });
    }
    draw();
    say(create ? '새 접속 코드를 정하십시오 (숫자 4~8자리)' : '접속 코드를 입력하십시오');
  }
  function fresh() { return { v: 1, created: Date.now(), cash: 0, granted: false, holdings: {}, log: [], work: { day: '' }, market: null, invest: { cd: 0, req: null, active: [], hist: [] }, fxw: {}, items: {}, mono: {}, jobs: {} }; }

  /* ───────── 진입: R.S.S. Mobile Simulation ───────── */
  function enter(isNew) {
    var d = S.data;
    K.start(d.market);
    var grant = !d.granted;
    if (grant) { d.granted = true; d.cash += GRANT; d.log.unshift({ t: Date.now(), k: 'grant', levc: GRANT }); S.save(); }
    app.innerHTML = '';
    var line1 = h('div', { class: 'sp-t' }), line2 = h('div', { class: 'sp-s' }), amt = h('div', { class: 'sp-a' });
    app.appendChild(h('section', { class: 'splash' }, h('div', { class: 'sp-em', html: window.RSSEmblem.svg({ color: '#FFB020' }) }), line1, line2, amt));
    M.decode(line1, 'R.S.S. Mobile Simulation', 22).then(function () {
      return M.decode(line2, grant ? '지갑에 시작 자금이 지급되었습니다' : '시뮬레이션에 다시 연결되었습니다', 20);
    }).then(function () {
      if (grant) { M.sound.power(); countUp(amt, GRANT, 900); }
      setTimeout(main, grant ? 1900 : 700);
    });
    void isNew;
  }
  function countUp(el, to, ms) {
    var t0 = performance.now();
    (function f(now) { var k = Math.min(1, (now - t0) / ms); el.textContent = '+ ' + M.num(Math.round(to * (1 - Math.pow(1 - k, 3)))) + ' LEVC'; if (k < 1) requestAnimationFrame(f); })(t0);
  }

  /* ───────── 본 화면 ───────── */
  var tab = 'wallet', undo = null, sheet = null;
  function main() {
    app.innerHTML = '';
    var total = h('b'), pl = h('span');
    var head = h('header', { class: 'top' },
      h('div', { class: 'top-l', html: window.RSSEmblem.svg({ color: '#FFB020' }) }),
      h('div', { class: 'top-m' }, h('div', { class: 'top-w' }, 'R.S.S. ', h('em', null, 'MOBILE SIMULATION')), h('div', { class: 'top-v' }, total, pl)),
      h('button', { class: 'top-x', type: 'button', onclick: function () { S.flush(); location.reload(); } }, 'LOCK'));
    var view = h('main', { class: 'view' });
    var nav = h('nav', { class: 'tabs' });
    [['wallet', '지갑', 'WLT'], ['folio', '보유', 'PFO'], ['market', '시장', 'MKT'], ['shop', '상점', 'SHP'], ['work', '일하기', 'WRK'], ['log', '기록', 'LOG']].forEach(function (t) {
      nav.appendChild(h('button', { class: 'tab' + (tab === t[0] ? ' on' : ''), type: 'button', 'data-t': t[0], onclick: function () { go(t[0]); } }, h('i', null, t[2]), h('span', null, t[1])));
    });
    app.appendChild(head); app.appendChild(view); app.appendChild(nav);
    function headUpd() { var v = worth(); M.rec.total(v.total); total.textContent = M.levc(v.total); pl.textContent = ' ' + M.pct(v.pl); pl.className = v.pl >= 0 ? 'up' : 'down'; }
    function go(t) {
      tab = t; M.sound.tap();
      [].forEach.call(nav.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
      if (undo) { undo(); undo = null; }
      view.innerHTML = ''; view.scrollTop = 0;
      undo = ({ wallet: wallet, folio: folio, market: market, shop: shop, work: work, log: logView })[t](view) || null;
    }
    K.listeners.push(headUpd);
    // 시장 상태는 10초마다 보관소에 저장
    setInterval(function () { S.data.market = K.snapshot(); S.save(); }, 10000);
    M.workReset = function () { if (tab === 'work') go('work'); };
    M.invest.start();
    M.econ.start();
    M.invest.listeners.push(headUpd);
    M.econ.listeners.push(headUpd);
    headUpd(); go(tab);
  }

  /* 자산 계산: 현금 + 보유 주식(지금 주가 × 수량을 지금 환율로 LEVC 로) */
  function worth() {
    var d = S.data, hold = 0, cost = 0;
    Object.keys(d.holdings).forEach(function (id) { var x = d.holdings[id], c = K.co(id); if (!c || !x.q) return; hold += K.toLevc(x.q * c.price, c.cur); cost += x.cost; });
    var start = d.log.filter(function (l) { return l.k === 'grant' || l.k === 'work'; }).reduce(function (s, l) { return s + l.levc; }, 0);
    var inv = M.invest.invested(), loc = M.econ.localValue(), mono = M.econ.monoValue(), total = d.cash + hold + inv + loc + mono;
    return { total: total, cash: d.cash, hold: hold, inv: inv, loc: loc, mono: mono, cost: cost, pl: start ? (total / start - 1) * 100 : 0 };
  }

  function spark(cv, a) {
    var r = cv.getBoundingClientRect(), k = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * k), hh = Math.round(r.height * k);
    if (!w || !hh) return;
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    var g = cv.getContext('2d'), pts = a.candles.slice(-40).map(function (c) { return c.c; }).concat([a.price]);
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), rg = hi - lo || hi * 1e-6;
    g.clearRect(0, 0, w, hh); g.lineWidth = 1.4 * k; g.strokeStyle = K.change(a) >= 0 ? '#FFB020' : '#E0412B'; g.beginPath();
    pts.forEach(function (v, i) { var x = i / (pts.length - 1) * (w - 2) + 1, y = hh - 2 - (v - lo) / rg * (hh - 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }

  /* ── 지갑 ── */
  function wallet(v) {
    var big = h('div', { class: 'w-total' }), cash = h('b'), hold = h('b'), plv = h('b');
    var list = h('div', { class: 'rows' }), fx = h('div', { class: 'fxs' });
    v.appendChild(h('section', { class: 'card w-card' }, h('div', { class: 'k' }, 'TOTAL ASSETS · 총 자산'), big,
      h('div', { class: 'w-grid' }, h('div', null, h('span', null, '현금'), cash), h('div', null, h('span', null, '주식 평가액'), hold), h('div', null, h('span', null, '총 수익률'), plv))));
    v.appendChild(h('div', { class: 'sec' }, '보유 주식'));
    v.appendChild(list);
    v.appendChild(h('div', { class: 'sec' }, '환율 · 1 LEVC 당'));
    v.appendChild(fx);
    v.appendChild(h('p', { class: 'note' }, '이 지갑과 투자는 시뮬레이션입니다. R.S.S. 컴퓨터 시스템에는 영향을 주지 않습니다.'));
    var fxEls = {};
    K.FX.forEach(function (f) { var val = h('b'), ch = h('span'); fxEls[f.code] = { val: val, ch: ch }; fx.appendChild(h('div', { class: 'fx' }, h('span', { class: 'n' }, f.ko, h('em', null, f.code)), val, ch)); });
    var built = '';
    function upd() {
      var w = worth(), d = S.data;
      big.textContent = M.levc(w.total); cash.textContent = M.num(Math.round(w.cash)); hold.textContent = M.num(Math.round(w.hold));
      plv.textContent = M.pct(w.pl); plv.className = w.pl >= 0 ? 'up' : 'down';
      var ids = Object.keys(d.holdings).filter(function (id) { return d.holdings[id].q > 0; });
      if (ids.join() !== built) {
        built = ids.join(); list.innerHTML = '';
        if (!ids.length) list.appendChild(h('div', { class: 'empty' }, '보유한 주식이 없습니다. 시장에서 기업에 투자해 보십시오.'));
        ids.forEach(function (id) {
          var c = K.co(id);
          list.appendChild(h('button', { class: 'row', type: 'button', 'data-id': id, onclick: function () { detail(id); } },
            h('span', { class: 'r-n' }, c.ko, h('em', null, M.num(d.holdings[id].q) + '주 · ' + c.cur)), h('span', { class: 'r-v' }), h('span', { class: 'r-c' })));
        });
      }
      [].forEach.call(list.querySelectorAll('.row'), function (r) {
        var id = r.getAttribute('data-id'), x = d.holdings[id], c = K.co(id), val = K.toLevc(x.q * c.price, c.cur), p = (val / x.cost - 1) * 100;
        r.querySelector('.r-v').textContent = M.num(Math.round(val)); var rc = r.querySelector('.r-c'); rc.textContent = M.pct(p); rc.className = 'r-c ' + (p >= 0 ? 'up' : 'down');
      });
      K.FX.forEach(function (f) { var ch = -K.change(f); fxEls[f.code].val.textContent = M.fx(f.price); fxEls[f.code].ch.textContent = '가치 ' + M.pct(ch, 3); fxEls[f.code].ch.className = ch >= 0 ? 'up' : 'down'; });
    }
    K.listeners.push(upd); upd();
    return function () { K.listeners.splice(K.listeners.indexOf(upd), 1); };
  }

  /* ── 보유: 산 주식 한눈에 + 진행 중인 투자 · 투자 결과 ── */
  function folio(v) {
    var d = S.data, sum = h('section', { class: 'card pf-sum' }), list = h('div', { class: 'pf-list' }), inv = h('div', { class: 'logs' }), hist = h('div', { class: 'logs' });
    v.appendChild(sum);
    v.appendChild(h('div', { class: 'sec' }, '보유 주식'));
    v.appendChild(list);
    v.appendChild(h('div', { class: 'sec' }, '진행 중인 투자'));
    v.appendChild(inv);
    v.appendChild(h('div', { class: 'sec' }, '투자 결과'));
    v.appendChild(hist);
    v.appendChild(h('p', { class: 'note' }, '보유한 기업에서 가끔 투자 요청이 옵니다. 요청 금액은 그 기업 나라의 화폐로 제시되고, 결과는 60초 뒤에 나옵니다.'));
    var cards = {}, built = '', n = 0;
    function build(ids) {
      list.innerHTML = ''; cards = {};
      if (!ids.length) { list.appendChild(h('div', { class: 'empty' }, '보유한 주식이 없습니다. 시장에서 기업 주식을 사 보십시오.')); return; }
      ids.forEach(function (id) {
        var c = K.co(id), nat = K.FX.filter(function (f) { return f.code === c.cur; })[0];
        var el = { q: h('b'), avg: h('b'), now: h('b'), val: h('b'), pl: h('b'), plp: h('span', { class: 'pf-plp' }), sp: h('canvas', { class: 'pf-sp' }) };
        list.appendChild(h('button', { class: 'pf' + (c.risky ? ' risky' : ''), type: 'button', onclick: function () { detail(id); } },
          h('div', { class: 'pf-h' }, h('div', null, h('div', { class: 'pf-n' }, c.ko), h('div', { class: 'pf-t' }, nat.ko + ' · ' + c.cur + ' · ' + c.sec + (c.risky ? ' · 고위험' : ''))), el.plp),
          el.sp,
          h('div', { class: 'pf-g' },
            h('div', null, h('span', null, '보유 수량'), el.q), h('div', null, h('span', null, '평균 매수가'), el.avg), h('div', null, h('span', null, '현재가'), el.now),
            h('div', null, h('span', null, '평가액'), el.val), h('div', null, h('span', null, '손익'), el.pl))));
        cards[id] = el;
      });
    }
    function upd() {
      n++;
      var w = worth(), ids = Object.keys(d.holdings).filter(function (id) { return d.holdings[id].q > 0 && K.co(id); });
      sum.innerHTML = '';
      sum.appendChild(h('div', { class: 'k' }, 'PORTFOLIO · 보유 현황'));
      sum.appendChild(h('div', { class: 'w-grid' },
        h('div', null, h('span', null, '주식 평가액'), h('b', null, M.num(Math.round(w.hold)))),
        h('div', null, h('span', null, '투자 진행 중'), h('b', null, M.num(Math.round(w.inv)))),
        h('div', null, h('span', null, '보유 종목'), h('b', null, ids.length + '곳'))));
      if (ids.join() !== built) { built = ids.join(); build(ids); n = 1; }
      ids.forEach(function (id) {
        var x = d.holdings[id], c = K.co(id), e = cards[id]; if (!e) return;
        if (x.lc == null) x.lc = x.cost * K.fx(c.cur);           // 예전 기록: 나라 화폐 원가를 지금 환율로 추정
        var val = K.toLevc(x.q * c.price, c.cur), pl = val - x.cost, p = (val / x.cost - 1) * 100;
        e.q.textContent = M.num(x.q) + '주'; e.avg.textContent = M.px(x.lc / x.q) + ' ' + c.cur; e.now.textContent = M.px(c.price) + ' ' + c.cur;
        e.val.textContent = M.num(Math.round(val)) + ' LEVC';
        e.pl.textContent = (pl >= 0 ? '+' : '−') + M.num(Math.abs(Math.round(pl))); e.pl.className = pl >= 0 ? 'up' : 'down';
        e.plp.textContent = M.pct(p); e.plp.className = 'pf-plp ' + (p >= 0 ? 'up' : 'down');
        if (n % 12 === 1) spark(e.sp, c);
      });
      // 진행 중인 투자 · 결과
      var act = M.invest.pending();
      inv.innerHTML = '';
      if (!act.length) inv.appendChild(h('div', { class: 'empty' }, '진행 중인 투자가 없습니다.'));
      act.forEach(function (a) {
        var c = K.co(a.id), left = Math.max(0, Math.ceil((a.at - Date.now()) / 1000));
        inv.appendChild(h('div', { class: 'lg' }, h('span', { class: 't' }, '결과까지 ' + left + '초'), h('span', { class: 'm' }, (c ? c.ko : a.id) + ' · ' + M.num(a.local) + ' ' + a.cur), h('b', null, M.num(Math.round(a.paid)))));
      });
      var hs = M.invest.history();
      if (hist.dataset.n !== String(hs.length ? hs[0].t : 0)) {
        hist.dataset.n = String(hs.length ? hs[0].t : 0); hist.innerHTML = '';
        if (!hs.length) hist.appendChild(h('div', { class: 'empty' }, '아직 투자 결과가 없습니다.'));
        hs.slice(0, 20).forEach(function (r) {
          var c = K.co(r.id), g = r.back - r.paid;
          hist.appendChild(h('div', { class: 'lg' }, h('span', { class: 't' }, M.hms(r.t)), h('span', { class: 'm' }, (c ? c.ko : r.id) + ' · 투자 ' + M.num(Math.round(r.paid)) + ' → ' + M.num(r.back)), h('b', { class: g >= 0 ? 'up' : 'down' }, (g >= 0 ? '+' : '−') + M.num(Math.abs(g)))));
        });
      }
    }
    K.listeners.push(upd); M.invest.listeners.push(upd); upd();
    return function () { K.listeners.splice(K.listeners.indexOf(upd), 1); M.invest.listeners.splice(M.invest.listeners.indexOf(upd), 1); };
  }

  /* ── 시장 ── */
  function market(v) {
    var rows = [];
    K.NATIONS.forEach(function (code) {
      var f = K.FX.filter(function (x) { return x.code === code; })[0], fxv = h('b');
      v.appendChild(h('div', { class: 'sec nat' }, h('span', null, f.ko), h('em', null, code), h('span', { class: 'fxr' }, '1 LEVC = ', fxv)));
      var box = h('div', { class: 'rows' });
      K.CO.filter(function (c) { return c.cur === code; }).forEach(function (c) {
        var pr = h('span', { class: 'r-v' }), ch = h('span', { class: 'r-c' }), sp = h('canvas', { class: 'r-sp' });
        box.appendChild(h('button', { class: 'row' + (c.risky ? ' risky' : ''), type: 'button', onclick: function () { detail(c.id); } },
          h('span', { class: 'r-n' }, c.ko, h('em', null, (M.econ.owns(c.id) ? '독점 · ' : '') + (c.risky ? '고위험 · ' : '') + c.sec)), sp, pr, ch));
        rows.push({ c: c, pr: pr, ch: ch, sp: sp });
      });
      rows.push({ fx: f, el: fxv });
      v.appendChild(box);
    });
    v.appendChild(h('p', { class: 'note' }, '주가는 각 나라 화폐 기준 · 등락은 접속 시점 대비 · 고위험 기업은 크게 오르고 크게 떨어집니다.'));
    var n = 0;
    function upd() {
      n++;
      rows.forEach(function (r) {
        if (r.fx) { r.el.textContent = M.fx(r.fx.price) + ' ' + r.fx.code; return; }
        var p = K.change(r.c); r.pr.textContent = M.px(r.c.price); r.ch.textContent = M.pct(p); r.ch.className = 'r-c ' + (p >= 0 ? 'up' : 'down');
        if (n % 12 === 1) spark(r.sp, r.c);
      });
    }
    K.listeners.push(upd); upd();
    return function () { K.listeners.splice(K.listeners.indexOf(upd), 1); };
  }

  /* ── 기업 상세 · 매수 · 매도 (아래에서 올라오는 창) ── */
  function detail(id) {
    var c = K.co(id), d = S.data;
    if (sheet) sheet();
    var price = h('div', { class: 'd-p' }), sub = h('div', { class: 'd-s' }), cv = h('canvas', { class: 'd-chart' });
    var holdEl = h('div', { class: 'd-hold' }), qty = h('input', { class: 'inp', type: 'number', inputmode: 'numeric', min: '1', step: '1', value: '1' });
    // 독점 취소: 실수로 누르지 않게 두 번 눌러야 함 (3초 안에)
    var unArm = 0, unBtn = h('button', { class: 'btn mono off', type: 'button', onclick: function () {
      if (!unArm) { unArm = setTimeout(function () { unArm = 0; unBtn.classList.remove('arm'); unBtn.textContent = '독점 취소'; }, 3000); unBtn.classList.add('arm'); unBtn.textContent = '한 번 더 누르면 취소'; M.sound.tap(); return; }
      clearTimeout(unArm); unArm = 0; unBtn.classList.remove('arm');
      var got = M.econ.unmonoRefund(c), err = M.econ.unmonopolize(id);
      if (err) { M.sound.deny(); return M.toast(err); }
      M.sound.sell(); M.toast(c.ko + ' 독점 취소 · +' + M.levc(got)); upd();
    } }, '독점 취소');
    var est = h('div', { class: 'd-est' }), monoEl = h('div', { class: 'd-mono' }), monoBtn = h('button', { class: 'btn mono', type: 'button', onclick: function () { var err = M.econ.monopolize(id); if (err) { M.sound.deny(); return M.toast(err); } M.sound.power(); M.toast(c.ko + ' 독점 완료'); upd(); } }, '기업 독점');
    var bBuy = h('button', { class: 'btn buy', type: 'button', onclick: function () { trade(1); } }, '매수');
    var bSell = h('button', { class: 'btn sell', type: 'button', onclick: function () { trade(-1); } }, '매도');
    var quick = h('div', { class: 'quick' });
    [['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].forEach(function (q) {
      quick.appendChild(h('button', { type: 'button', onclick: function () { var per = K.toLevc(c.price, c.cur); qty.value = Math.max(1, Math.floor(d.cash * q[1] / per)); M.sound.tap(); upd(); } }, q[0]));
    });
    quick.appendChild(h('button', { type: 'button', onclick: function () { var x = d.holdings[id]; qty.value = x && x.q ? x.q : 1; M.sound.tap(); upd(); } }, '전량'));
    var el = h('section', { class: 'sheet' },
      h('div', { class: 'sh-bar' }, h('button', { class: 'sh-x', type: 'button', onclick: function () { close(); } }, '닫기')),
      h('div', { class: 'd-h' }, h('div', null, h('h2', null, c.ko), h('div', { class: 'd-tag' }, c.sec + ' · ' + K.FX.filter(function (f) { return f.code === c.cur; })[0].ko + ' · ' + c.cur + (c.risky ? ' · 고위험' : ''))), h('div', { class: 'd-q' }, price, sub)),
      h('div', { class: 'd-cbox' }, cv), h('div', { class: 'd-cap' }, '봉 하나 = 3초 · 점선 = 20봉 이동평균 · 시장 시간 60배속'),
      holdEl,
      monoEl,
      h('div', { class: 'd-trade' }, h('label', null, h('span', null, '수량 (주)'), qty), quick, est, h('div', { class: 'd-btns' }, bBuy, bSell)));
    var shade = h('div', { class: 'shade', onclick: function () { close(); } });
    document.body.appendChild(shade); document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); shade.classList.add('in'); });
    qty.addEventListener('input', upd);
    function close() { el.classList.remove('in'); shade.classList.remove('in'); K.listeners.splice(K.listeners.indexOf(upd), 1); M.econ.listeners.splice(M.econ.listeners.indexOf(upd), 1); setTimeout(function () { el.remove(); shade.remove(); }, 260); sheet = null; }
    sheet = close;
    function trade(dir) {
      var q = Math.floor(+qty.value || 0); if (q < 1) return M.toast('수량을 1주 이상 입력하십시오');
      var levc = K.toLevc(q * c.price, c.cur), x = d.holdings[id] || (d.holdings[id] = { q: 0, cost: 0 });
      if (dir > 0) {
        if (levc > d.cash) { M.sound.deny(); return M.toast('현금이 부족합니다'); }
        d.cash -= levc; x.q += q; x.cost += levc; x.lc = (x.lc || 0) + q * c.price; M.sound.buy(); M.rec.event('buy', c);
      } else {
        if (q > x.q) { M.sound.deny(); return M.toast('보유 수량보다 많이 팔 수 없습니다'); }
        var ratio = q / x.q; x.cost -= x.cost * ratio; if (x.lc) x.lc -= x.lc * ratio; x.q -= q; d.cash += levc; M.sound.sell(); M.rec.event('sell', c);
        if (!x.q) delete d.holdings[id];
      }
      d.log.unshift({ t: Date.now(), k: dir > 0 ? 'buy' : 'sell', id: id, q: q, px: c.price, cur: c.cur, fx: K.fx(c.cur), levc: levc });
      if (d.log.length > 400) d.log.length = 400;
      S.data.market = K.snapshot(); S.save();
      M.toast((dir > 0 ? '매수 ' : '매도 ') + c.ko + ' ' + M.num(q) + '주 · ' + M.levc(levc));
      upd();
    }
    var tickN = 0;
    function upd() {
      tickN++;
      var p = K.change(c), q = Math.max(0, Math.floor(+qty.value || 0)), levc = K.toLevc(q * c.price, c.cur), x = d.holdings[id];
      price.textContent = M.px(c.price) + ' ' + c.cur;
      sub.textContent = '≈ ' + M.num(K.toLevc(c.price, c.cur), 2) + ' LEVC · ' + M.pct(p); sub.className = 'd-s ' + (p >= 0 ? 'up' : 'down');
      est.textContent = M.num(q) + '주 = ' + M.px(q * c.price) + ' ' + c.cur + ' ≈ ' + M.levc(levc) + '  (1 LEVC = ' + M.fx(K.fx(c.cur)) + ' ' + c.cur + ')';
      holdEl.innerHTML = '';
      if (x && x.q) {
        var val = K.toLevc(x.q * c.price, c.cur), pp = (val / x.cost - 1) * 100;
        holdEl.appendChild(h('div', null, h('span', null, '보유'), h('b', null, M.num(x.q) + '주')));
        holdEl.appendChild(h('div', null, h('span', null, '평가액'), h('b', null, M.num(Math.round(val)) + ' LEVC')));
        holdEl.appendChild(h('div', null, h('span', null, '수익률'), h('b', { class: pp >= 0 ? 'up' : 'down' }, M.pct(pp))));
      } else holdEl.appendChild(h('div', null, h('span', null, '현금'), h('b', null, M.levc(d.cash))));
      // 독점: 주가 × 150,000 (그 나라 화폐) · 그 순간 환율로 LEVC 지불
      monoEl.innerHTML = '';
      var ml = M.econ.monoCostLocal(c), mv = M.econ.monoCostLevc(c), own = M.econ.data().mono[id];
      if (own) {
        monoEl.classList.add('own');
        monoEl.appendChild(h('div', { class: 'dm-h' }, h('span', { class: 'dm-k' }, 'MONOPOLY'), h('b', null, '독점 중')));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '독점 가치'), h('b', null, M.px(ml) + ' ' + c.cur + ' ≈ ' + M.levc(mv))));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '독점 수익 (1분마다)'), h('b', { class: 'up' }, '+' + M.px(ml * M.econ.MONO_YIELD) + ' ' + c.cur)));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '지금까지 받은 수익'), h('b', null, M.px(own.earned) + ' ' + c.cur)));
        var back = M.econ.unmonoRefund(c);
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '취소하면 돌려받는 돈 (수수료 10%)'), h('b', { class: back >= own.paid ? 'up' : 'down' }, M.levc(back))));
        monoEl.appendChild(unBtn); if (!unArm) unBtn.textContent = '독점 취소';
      } else {
        monoEl.classList.remove('own');
        monoEl.appendChild(h('div', { class: 'dm-h' }, h('span', { class: 'dm-k' }, 'MONOPOLY'), h('b', null, '기업 독점')));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '독점 비용 (주가 × 150,000)'), h('b', null, M.px(ml) + ' ' + c.cur)));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '지금 환율로'), h('b', { class: mv > d.cash ? 'down' : '' }, M.levc(mv))));
        monoEl.appendChild(h('div', { class: 'dm-r' }, h('span', null, '독점 수익'), h('b', null, '1분마다 독점 가치의 0.1% (' + c.cur + ')')));
        monoEl.appendChild(monoBtn);
      }
      chart(cv, c);
    }
    K.listeners.push(upd); M.econ.listeners.push(upd); upd();
  }

  function chart(cv, a) {
    var r = cv.getBoundingClientRect(), k = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * k), hh = Math.round(r.height * k);
    if (!w || !hh) return;
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    var g = cv.getContext('2d'), padR = 64 * k, W = w - padR, padT = 8 * k, H = hh - 16 * k, cw = 7 * k;
    var n = Math.max(8, Math.floor(W / cw)), list = a.candles.slice(-(n - 1)).concat([a.bar]);
    g.fillStyle = '#07080A'; g.fillRect(0, 0, w, hh);
    var lo = Infinity, hi = -Infinity; list.forEach(function (q) { lo = Math.min(lo, q.l); hi = Math.max(hi, q.h); });
    var pad = (hi - lo) * 0.1 || hi * 1e-4; lo -= pad; hi += pad;
    var Y = function (v) { return padT + (hi - v) / (hi - lo) * H; };
    g.font = (10 * k) + 'px D2Coding, monospace'; g.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) { var v = lo + (hi - lo) * i / 4, y = Math.round(Y(v)) + 0.5; g.strokeStyle = 'rgba(255,176,32,.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillStyle = '#A69B84'; g.fillText(M.px(v), W + 6 * k, y); }
    var x0 = W - list.length * cw;
    list.forEach(function (q, i) {
      var x = x0 + i * cw, up = q.c >= q.o, col = up ? '#FFB020' : '#E0412B';
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, k);
      var cx = Math.round(x + cw / 2) + 0.5; g.beginPath(); g.moveTo(cx, Y(q.h)); g.lineTo(cx, Y(q.l)); g.stroke();
      var top = Math.min(Y(q.o), Y(q.c)), bh = Math.max(1, Math.abs(Y(q.c) - Y(q.o)));
      if (up) g.fillRect(x + k, top, cw - 2 * k, bh); else { g.fillStyle = '#07080A'; g.fillRect(x + k, top, cw - 2 * k, bh); g.strokeRect(x + k + 0.5, top + 0.5, cw - 2 * k - 1, bh - 1); }
    });
    var all = a.candles.concat([a.bar]); g.strokeStyle = 'rgba(243,232,210,.5)'; g.setLineDash([3 * k, 3 * k]); g.beginPath(); var st = false;
    list.forEach(function (q, i) { var idx = all.length - list.length + i; if (idx < 19) return; var m = 0; for (var j = idx - 19; j <= idx; j++) m += all[j].c; m /= 20; var x = x0 + i * cw + cw / 2; if (st) g.lineTo(x, Y(m)); else { g.moveTo(x, Y(m)); st = true; } });
    g.stroke(); g.setLineDash([]);
    var yp = Math.round(Y(a.price)) + 0.5; g.fillStyle = '#FFB020'; g.fillRect(W + 2 * k, yp - 8 * k, padR - 4 * k, 16 * k);
    g.fillStyle = '#1A1206'; g.font = '700 ' + (10 * k) + 'px D2Coding, monospace'; g.fillText(M.px(a.price), W + 5 * k, yp);
  }

  /* ── 일하기 ── */
  function work(v) {
    return M.jobsView(v, function (pay, job) {
      var j = M.JOBS.filter(function (x) { return x.id === job; })[0];
      S.data.cash += pay; S.data.log.unshift({ t: Date.now(), k: 'work', levc: pay, job: job }); S.save(); S.flush();
      M.rec.event('work', { pay: pay, job: job });
      M.toast((j ? j.ko : '일') + ' · ' + M.levc(pay) + ' 지급');
    });
  }

  /* ── 상점: 나라 화폐 지갑 · 환전 · 특산품 · 소장품 ── */
  var shopNat = 'VEC';
  function shop(v) {
    var E = M.econ, d = E.data();
    var bal = h('div', { class: 'sp-bal' }), chips = h('div', { class: 'sp-chips' }), items = h('div', { class: 'sp-items' }), coll = h('div', { class: 'sp-coll' });
    var amt = h('input', { class: 'inp', type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: '금액' });
    var dirBtn = h('div', { class: 'sp-dir' }), quote = h('div', { class: 'sp-q' }), dir = 1;
    var go2 = h('button', { class: 'btn buy', type: 'button', onclick: function () { var err = E.exchange(dir, amt.value, shopNat); if (err) { M.sound.deny(); return M.toast(err); } M.sound.buy(); M.toast('환전 완료'); amt.value = ''; upd(); } }, '환전');
    v.appendChild(h('div', { class: 'sec' }, '나라 화폐 지갑'));
    v.appendChild(bal);
    v.appendChild(h('div', { class: 'sec' }, '환전 · 수수료 ' + (E.FEE * 100) + '%'));
    v.appendChild(chips);
    v.appendChild(h('section', { class: 'card sp-ex' }, dirBtn, amt, quote, go2));
    v.appendChild(h('div', { class: 'sec' }, '특산품 · 그 나라 화폐로만 살 수 있음'));
    v.appendChild(items);
    v.appendChild(h('div', { class: 'sec' }, '소장품'));
    v.appendChild(coll);
    function setDir(x) { dir = x; dirBtn.innerHTML = '';
      dirBtn.appendChild(h('button', { class: 'tabx' + (dir > 0 ? ' on' : ''), type: 'button', onclick: function () { setDir(1); M.sound.tap(); } }, 'LEVC → ' + shopNat));
      dirBtn.appendChild(h('button', { class: 'tabx' + (dir < 0 ? ' on' : ''), type: 'button', onclick: function () { setDir(-1); M.sound.tap(); } }, shopNat + ' → LEVC'));
      amt.placeholder = dir > 0 ? '보낼 LEVC' : '보낼 ' + shopNat; upd(); }
    function drawChips() { chips.innerHTML = '';
      K.NATIONS.forEach(function (n) { var f = K.FX.filter(function (x) { return x.code === n; })[0];
        chips.appendChild(h('button', { class: 'chip' + (n === shopNat ? ' on' : ''), type: 'button', onclick: function () { shopNat = n; M.sound.tap(); drawChips(); setDir(dir); drawItems(); } }, f.ko.replace(/\(.*\)/, ''), h('em', null, n))); }); }
    function drawItems() { items.innerHTML = '';
      E.ITEMS.filter(function (i) { return i.cur === shopNat; }).forEach(function (it) {
        var n = d.items[it.id] || 0;
        items.appendChild(h('div', { class: 'sp-item' + (n ? ' has' : '') },
          h('div', null, h('b', null, it.ko), h('span', null, it.by + (n ? ' · ' + n + '개 소장' : ''))),
          h('div', { class: 'sp-ip' }, h('b', null, M.px(it.price) + ' ' + it.cur), h('span', { class: 'sp-lv' }, '≈ ' + M.num(Math.round(K.toLevc(it.price, it.cur))) + ' LEVC')),
          h('button', { class: 'btn sell sp-buy', type: 'button', onclick: function () { var err = E.buyItem(it.id); if (err) { M.sound.deny(); return M.toast(err); } M.sound.buy(); M.toast(it.ko + ' 구매'); drawItems(); drawColl(); upd(); } }, '구매')));
      }); }
    function drawColl() { coll.innerHTML = '';
      var ids = Object.keys(d.items).filter(function (k) { return d.items[k] > 0; });
      if (!ids.length) { coll.appendChild(h('div', { class: 'empty' }, '아직 모은 특산품이 없습니다.')); return; }
      ids.forEach(function (k) { var it = E.item(k); if (it) coll.appendChild(h('div', { class: 'sp-ci' }, h('em', null, it.cur), h('b', null, it.ko), h('span', null, '× ' + d.items[k]))); }); }
    function upd() {
      bal.innerHTML = '';
      K.NATIONS.forEach(function (n) { var f = K.FX.filter(function (x) { return x.code === n; })[0];
        bal.appendChild(h('div', { class: 'sp-b' + (n === shopNat ? ' on' : '') }, h('span', null, f.ko.replace(/\(.*\)/, '')), h('b', null, M.px(d.fxw[n] || 0)), h('em', null, n))); });
      var a = +amt.value || 0;
      quote.textContent = dir > 0 ? (a ? M.num(a) + ' LEVC → ' + M.px(E.quoteBuy(a, shopNat)) + ' ' + shopNat : '1 LEVC = ' + M.fx(K.fx(shopNat)) + ' ' + shopNat + ' · 현금 ' + M.levc(S.data.cash))
                                  : (a ? M.px(a) + ' ' + shopNat + ' → ' + M.num(Math.round(E.quoteSell(a, shopNat))) + ' LEVC' : shopNat + ' 잔액 ' + M.px(d.fxw[shopNat] || 0));
    }
    amt.addEventListener('input', upd);
    drawChips(); setDir(1); drawItems(); drawColl();
    var tickU = function () { upd(); };
    K.listeners.push(tickU); E.listeners.push(tickU);
    return function () { K.listeners.splice(K.listeners.indexOf(tickU), 1); E.listeners.splice(E.listeners.indexOf(tickU), 1); };
  }

  /* ── 기록 ── */
  function logView(v) {
    var d = S.data, list = h('div', { class: 'logs' }), news = h('div', { class: 'logs' }), s = M.rec.stats(), w = worth();
    v.appendChild(h('section', { class: 'card rc' }, h('div', { class: 'k' }, 'RECORDS · 기록'),
      h('div', { class: 'w-grid rc-g' },
        h('div', null, h('span', null, '최고 총 자산'), h('b', null, M.num(Math.round(Math.max(s.peak, w.total))))),
        h('div', null, h('span', null, '연구 성공 · 실패'), h('b', null, s.rsOk + ' · ' + s.rsFail)),
        h('div', null, h('span', null, '거래 횟수'), h('b', null, M.num(s.trades))),
        h('div', null, h('span', null, '활성화 연속'), h('b', null, s.streak + '일 (최장 ' + s.best + ')')),
        h('div', null, h('span', null, '일하기 보수'), h('b', null, M.num(s.workPay))),
        h('div', null, h('span', null, '독점 수익 합계'), h('b', null, M.num(Math.round(s.monoIncome)) + ' LEVC')))));
    var got = Object.keys(d.ach || {}).length;
    v.appendChild(h('div', { class: 'sec' }, '업적 ' + got + ' / ' + M.rec.ACH.length));
    var ag = h('div', { class: 'ach' }); v.appendChild(ag);
    M.rec.ACH.forEach(function (a) { var t = d.ach && d.ach[a.id];
      ag.appendChild(h('div', { class: 'ach-i' + (t ? ' on' : '') }, h('b', null, a.ko), h('span', null, a.d), t ? h('em', null, M.day(t)) : h('em', null, '잠김'))); });
    v.appendChild(h('div', { class: 'sec' }, '거래 기록')); v.appendChild(list);
    v.appendChild(h('div', { class: 'sec' }, '시장 소식')); v.appendChild(news);
    if (!d.log.length) list.appendChild(h('div', { class: 'empty' }, '기록이 없습니다.'));
    d.log.slice(0, 120).forEach(function (l) {
      var dt = new Date(l.t), when = (dt.getMonth() + 1) + '.' + dt.getDate() + ' ' + M.hms(l.t), what, amt;
      if (l.k === 'grant') { what = '시작 자금 지급'; amt = '+' + M.num(l.levc); }
      else if (l.k === 'work') { var jj = M.JOBS.filter(function (x) { return x.id === (l.job || 'device'); })[0]; what = (jj ? jj.ko : '일') + ' 보수'; amt = '+' + M.num(l.levc); }
      else if (l.k === 'fx') { what = '환전 ' + (l.levc < 0 ? 'LEVC → ' + l.cur + ' ' + M.px(l.local) : l.cur + ' ' + M.px(-l.local) + ' → LEVC'); amt = (l.levc < 0 ? '−' : '+') + M.num(Math.round(Math.abs(l.levc))); }
      else if (l.k === 'item') { var it = M.econ.item(l.id); what = '특산품 ' + (it ? it.ko : l.id); amt = '−' + M.px(l.local) + ' ' + l.cur; }
      else if (l.k === 'mono') { var cm = K.co(l.id); what = '독점 ' + (cm ? cm.ko : l.id) + ' · ' + M.px(l.local) + ' ' + l.cur; amt = '−' + M.num(Math.round(l.levc)); }
      else if (l.k === 'unmono') { var cu = K.co(l.id); what = '독점 취소 ' + (cu ? cu.ko : l.id) + ' · 수수료 10%'; amt = '+' + M.num(Math.round(l.levc)); }
      else if (l.k === 'inv') { var ci = K.co(l.id); what = '투자 ' + (ci ? ci.ko : l.id) + ' ' + M.num(l.local) + ' ' + l.cur + ' (1 LEVC = ' + M.fx(l.fx) + ')'; amt = '−' + M.num(Math.round(l.levc)); }
      else if (l.k === 'invr') { var cr = K.co(l.id); what = '투자 결과 ' + (cr ? cr.ko : l.id) + ' · 투자금 ' + M.num(Math.round(l.paid)); amt = '+' + M.num(Math.round(l.levc)); }
      else { var c = K.co(l.id); what = (l.k === 'buy' ? '매수 ' : '매도 ') + (c ? c.ko : l.id) + ' ' + M.num(l.q) + '주 @ ' + M.px(l.px) + ' ' + l.cur + ' (1 LEVC = ' + M.fx(l.fx) + ')'; amt = (l.k === 'buy' ? '−' : '+') + M.num(Math.round(l.levc)); }
      list.appendChild(h('div', { class: 'lg ' + l.k }, h('span', { class: 't' }, when), h('span', { class: 'm' }, what), h('b', null, amt)));
    });
    var shown = -1;
    function upd() {
      var top = K.news.length ? K.news[0].t : 0; if (top === shown) return; shown = top; news.innerHTML = '';
      if (!K.news.length) news.appendChild(h('div', { class: 'empty' }, '아직 소식이 없습니다.'));
      K.news.slice(0, 15).forEach(function (n) { news.appendChild(h('div', { class: 'lg' + (n.big ? ' big' : '') }, h('span', { class: 't' }, M.hms(n.t)), h('span', { class: 'm' }, n.m), h('b', { class: n.dir > 0 ? 'up' : 'down' }, n.dir > 0 ? '▲' : '▼'))); });
    }
    K.listeners.push(upd); upd();
    return function () { K.listeners.splice(K.listeners.indexOf(upd), 1); };
  }

  /* 설치(오프라인) 지원 */
  // 안드로이드 앱(Capacitor)은 파일이 앱 안에 들어 있어 필요 없음 · 웹으로 열 때만 오프라인 보관
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(function () {});
  lock();
  // 새 버전 알림: 잠금 해제 · 시작 연출이 끝나 본 화면이 뜬 뒤에
  if (window.RSSUpdate) window.RSSUpdate.check({ name: 'R.S.S. Mobile', current: window.APP_VERSION, tag: 'mobile', apk: 'RSS-Mobile.apk', accent: '#FFB020', lift: 64, ready: function () { return !!document.querySelector('#app header.top'); } });
})();
