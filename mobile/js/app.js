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
  function fresh() { return { v: 1, created: Date.now(), cash: 0, granted: false, holdings: {}, log: [], work: { day: '' }, market: null }; }

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
    [['wallet', '지갑', 'WLT'], ['market', '시장', 'MKT'], ['work', '일하기', 'WRK'], ['log', '기록', 'LOG']].forEach(function (t) {
      nav.appendChild(h('button', { class: 'tab' + (tab === t[0] ? ' on' : ''), type: 'button', 'data-t': t[0], onclick: function () { go(t[0]); } }, h('i', null, t[2]), h('span', null, t[1])));
    });
    app.appendChild(head); app.appendChild(view); app.appendChild(nav);
    function headUpd() { var v = worth(); total.textContent = M.levc(v.total); pl.textContent = ' ' + M.pct(v.pl); pl.className = v.pl >= 0 ? 'up' : 'down'; }
    function go(t) {
      tab = t; M.sound.tap();
      [].forEach.call(nav.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
      if (undo) { undo(); undo = null; }
      view.innerHTML = ''; view.scrollTop = 0;
      undo = ({ wallet: wallet, market: market, work: work, log: logView })[t](view) || null;
    }
    K.listeners.push(headUpd);
    // 시장 상태는 10초마다 보관소에 저장
    setInterval(function () { S.data.market = K.snapshot(); S.save(); }, 10000);
    M.workReset = function () { if (tab === 'work') go('work'); };
    headUpd(); go(tab);
  }

  /* 자산 계산: 현금 + 보유 주식(지금 주가 × 수량을 지금 환율로 LEVC 로) */
  function worth() {
    var d = S.data, hold = 0, cost = 0;
    Object.keys(d.holdings).forEach(function (id) { var x = d.holdings[id], c = K.co(id); if (!c || !x.q) return; hold += K.toLevc(x.q * c.price, c.cur); cost += x.cost; });
    var start = d.log.filter(function (l) { return l.k === 'grant' || l.k === 'work'; }).reduce(function (s, l) { return s + l.levc; }, 0);
    var total = d.cash + hold;
    return { total: total, cash: d.cash, hold: hold, cost: cost, pl: start ? (total / start - 1) * 100 : 0 };
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
          h('span', { class: 'r-n' }, c.ko, h('em', null, (c.risky ? '고위험 · ' : '') + c.sec)), sp, pr, ch));
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
    var est = h('div', { class: 'd-est' });
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
      h('div', { class: 'd-trade' }, h('label', null, h('span', null, '수량 (주)'), qty), quick, est, h('div', { class: 'd-btns' }, bBuy, bSell)));
    var shade = h('div', { class: 'shade', onclick: function () { close(); } });
    document.body.appendChild(shade); document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); shade.classList.add('in'); });
    qty.addEventListener('input', upd);
    function close() { el.classList.remove('in'); shade.classList.remove('in'); K.listeners.splice(K.listeners.indexOf(upd), 1); setTimeout(function () { el.remove(); shade.remove(); }, 260); sheet = null; }
    sheet = close;
    function trade(dir) {
      var q = Math.floor(+qty.value || 0); if (q < 1) return M.toast('수량을 1주 이상 입력하십시오');
      var levc = K.toLevc(q * c.price, c.cur), x = d.holdings[id] || (d.holdings[id] = { q: 0, cost: 0 });
      if (dir > 0) {
        if (levc > d.cash) { M.sound.deny(); return M.toast('현금이 부족합니다'); }
        d.cash -= levc; x.q += q; x.cost += levc; M.sound.buy();
      } else {
        if (q > x.q) { M.sound.deny(); return M.toast('보유 수량보다 많이 팔 수 없습니다'); }
        x.cost -= x.cost * q / x.q; x.q -= q; d.cash += levc; M.sound.sell();
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
      chart(cv, c);
    }
    K.listeners.push(upd); upd();
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
    return M.work(v, S.data, function (pay) {
      S.data.cash += pay; S.data.log.unshift({ t: Date.now(), k: 'work', levc: pay }); S.save(); S.flush();
      M.toast('장치 활성화 · ' + M.levc(pay) + ' 지급');
    });
  }

  /* ── 기록 ── */
  function logView(v) {
    var d = S.data, list = h('div', { class: 'logs' }), news = h('div', { class: 'logs' });
    v.appendChild(h('div', { class: 'sec' }, '거래 기록')); v.appendChild(list);
    v.appendChild(h('div', { class: 'sec' }, '시장 소식')); v.appendChild(news);
    if (!d.log.length) list.appendChild(h('div', { class: 'empty' }, '기록이 없습니다.'));
    d.log.slice(0, 120).forEach(function (l) {
      var dt = new Date(l.t), when = (dt.getMonth() + 1) + '.' + dt.getDate() + ' ' + M.hms(l.t), what, amt;
      if (l.k === 'grant') { what = '시작 자금 지급'; amt = '+' + M.num(l.levc); }
      else if (l.k === 'work') { what = '장치 활성화 보수'; amt = '+' + M.num(l.levc); }
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
})();
