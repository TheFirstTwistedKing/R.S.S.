/* 인트로 = 잠금 화면. 앱을 켤 때마다, 잠근 뒤 다시 들어올 때마다 처음부터 재생된다. (다시보기 버튼 없음) */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var MIN = 4, MAX = 8, MAX_FAIL = 5, SHOW_MS = 650;

  var el = {}, st = { seq: 0, mode: 'unlock', buf: '', shown: -1, first: '', fails: 0, total: 0, busy: false, lockUntil: 0, envelope: null, done: null, typing: 0, hideT: 0 };

  function buildKeypad() {
    var pad = el.keypad; pad.innerHTML = '';
    '123456789'.split('').forEach(function (d) { pad.appendChild(h('button', { class: 'key', 'data-k': d, type: 'button' }, d)); });
    pad.appendChild(h('button', { class: 'key fn', 'data-k': 'clr', type: 'button' }, 'CLR'));
    pad.appendChild(h('button', { class: 'key', 'data-k': '0', type: 'button' }, '0'));
    pad.appendChild(h('button', { class: 'key fn', 'data-k': 'del', type: 'button', 'aria-label': '한 칸 지우기' }, 'DEL'));
    pad.appendChild(h('button', { class: 'key ok', 'data-k': 'ok', type: 'button' }, 'AUTHENTICATE'));
    R.$$('.key', pad).forEach(function (k, i) { k.style.setProperty('--k', i); });
    pad.addEventListener('click', function (e) { var b = e.target.closest('.key'); if (b) press(b.getAttribute('data-k')); });
  }

  /* 입력란: 방금 누른 숫자만 잠깐 픽셀 숫자로 보이고 곧 * 로 가려짐 */
  function renderSlots(pop) {
    var html = '';
    for (var i = 0; i < MAX; i++) {
      var has = i < st.buf.length;
      var cls = has ? 'on' : (i === st.buf.length ? 'cur' : '');
      if (!has && i >= MIN && i > st.buf.length) cls += ' off';
      if (pop && i === st.buf.length - 1) cls += ' pop';
      var ch = has ? (i === st.shown ? st.buf[i] : '*') : '';
      html += '<div class="slot ' + cls + '">' + ch + '</div>';
    }
    el.slots.innerHTML = html;
    el.count.textContent = st.buf.length + '/' + MAX;
    el.bar.style.width = (st.buf.length / MAX * 100) + '%';
  }

  /* 안내 문구: 빗금 막대 → 왼쪽부터 해독 (영상 방식) */
  function say(text, deny) {
    var my = ++st.typing;
    el.status.classList.toggle('deny', !!deny);
    el.status.innerHTML = '';
    var t = h('span'), caret = h('span', { class: 'caret' });
    el.status.appendChild(t); el.status.appendChild(caret);
    R.decode(t, text, { speed: 20, cb: function () { if (my !== st.typing) return; } });
    R.sound.tick();
  }

  function flashKey(k) {
    var b = el.keypad.querySelector('[data-k="' + k + '"]');
    if (!b) return;
    b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 110);
  }

  function press(k) {
    if (st.busy || st.mode === 'broken' || Date.now() < st.lockUntil) return;
    flashKey(k);
    // 타자음은 실제로 숫자가 써지거나 지워질 때만 (가득 찼거나 비어 있으면 꾹 눌러도 무음)
    if (/^\d$/.test(k)) {
      if (st.buf.length >= MAX) return;
      st.buf += k; st.shown = st.buf.length - 1; R.sound.stroke('key');
      clearTimeout(st.hideT);
      st.hideT = setTimeout(function () { st.shown = -1; renderSlots(); }, SHOW_MS);
      renderSlots(true); return;
    }
    if (k === 'del' || k === 'clr') {
      if (!st.buf) return;
      st.buf = k === 'del' ? st.buf.slice(0, -1) : ''; st.shown = -1; R.sound.stroke('key');
    }
    else if (k === 'ok') { if (st.buf) R.sound.stroke('enter'); submit(); return; }
    renderSlots();
  }

  function shake() {
    el.box.classList.remove('shake'); void el.box.offsetWidth; el.box.classList.add('shake');
    R.sound.deny();
  }

  function setMode(mode) {
    st.mode = mode; st.buf = ''; st.shown = -1; renderSlots();
    el.mode.textContent = mode === 'unlock' ? 'ACCESS CODE' : (mode === 'create1' ? 'NEW ACCESS CODE' : 'CONFIRM CODE');
  }

  function submit() {
    if (st.buf.length < MIN) { shake(); say('코드는 ' + MIN + '~' + MAX + '자리 숫자입니다.', true); return; }
    if (st.mode === 'create1') { st.first = st.buf; setMode('create2'); say('확인을 위해 같은 코드를 한 번 더 입력하십시오.'); return; }
    if (st.mode === 'create2') {
      if (st.buf !== st.first) { shake(); setMode('create1'); say('코드 불일치. 처음부터 다시 설정하십시오.', true); return; }
      busy(true); say('보관소 생성 중 · 암호화 키 파생');
      R.store.create(st.buf).then(function () { R.log('SEC', '신규 보관소 생성 · 접속 코드 등록'); grant(); }, function (e) { busy(false); say('생성 실패: ' + e.message, true); });
      return;
    }
    busy(true); say('VERIFYING · 신원 대조 중');
    R.store.unlock(st.buf, st.envelope).then(grant, function () {
      busy(false); st.fails++; st.total++; setMode('unlock'); shake();
      R.log('WARN', '접속 거부 · 코드 불일치');
      if (st.fails >= MAX_FAIL) {
        var wait = 30 * Math.pow(2, st.fails - MAX_FAIL);
        st.lockUntil = Date.now() + wait * 1000;
        R.log('SEC', '연속 실패 ' + st.fails + '회 · 입력 ' + wait + '초 차단');
        countdown();
      } else say('ACCESS DENIED · 코드 불일치 (' + st.fails + '/' + MAX_FAIL + ')', true);
      if (st.fails >= 3) showForgot();
    });
  }

  function countdown() {
    var left = Math.ceil((st.lockUntil - Date.now()) / 1000);
    el.keypad.classList.toggle('busy', left > 0);
    if (left <= 0) { say('차단 해제. 접속 코드를 입력하십시오.'); return; }
    el.status.classList.add('deny');
    el.status.innerHTML = R.esc('LOCKOUT · ' + left + '초 후 재시도') + '<span class="caret"></span>';
    setTimeout(countdown, 1000);
  }

  function busy(v) { st.busy = v; el.keypad.classList.toggle('busy', v); }

  function showForgot() {
    if (el.foot.querySelector('.btn')) return;
    el.foot.innerHTML = '';
    el.foot.appendChild(h('div', null, '코드를 잊으면 기록은 복구할 수 없습니다.'));
    el.foot.appendChild(h('button', { class: 'btn danger', type: 'button', style: { marginTop: '8px' }, onclick: wipeAsk }, '보관소 초기화'));
  }

  function wipeAsk() {
    R.ui.confirm('보관소 초기화', '저장된 모든 기록이 영구 삭제되고 새 코드를 설정합니다. 백업 파일이 있다면 이후 터미널에서 import 명령으로 가져올 수 있습니다.', '초기화', true).then(function (ok) {
      if (!ok) return;
      R.bridge.wipeVault().then(function () { st.fails = 0; st.envelope = null; el.foot.textContent = ''; R.log('WARN', '보관소 초기화 실행'); firstRun(); });
    });
  }

  function firstRun() {
    setMode('create1');
    $('#hudVault').textContent = 'NOT FOUND';
    say('신규 단말 감지. 접속 코드 ' + MIN + '~' + MAX + '자리를 설정하십시오.');
    el.foot.textContent = '이 코드로 모든 기록이 암호화됩니다. 분실 시 복구 불가.';
  }

  function grant() {
    busy(true);
    var failed = st.total;
    st.fails = 0; st.total = 0; st.shown = -1;
    R.flushPendingLogs();
    R.log('SEC', 'ACCESS GRANTED · 보관소 개방' + (failed ? ' · 직전 실패 ' + failed + '회' : ''));
    var slots = R.$$('.slot', el.slots);
    slots.forEach(function (s, i) { setTimeout(function () { s.className = 'slot on'; s.textContent = '*'; }, i * 40); });
    $('#hudVault').textContent = 'UNSEALED';
    say('ACCESS GRANTED · 보관소 개방');
    R.sound.grant();
    setTimeout(function () {
      el.root.classList.add('out');
      setTimeout(function () {
        el.root.hidden = true;
        el.root.classList.remove('out', 'boot');
        R.fx.globe(false);
        busy(false);
        var cb = st.done; st.done = null;
        if (cb) cb();
      }, 560);
    }, 950);
  }

  function onKey(e) {
    if (el.root.hidden || !R.$('#modal').hidden) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Escape') press('clr');
    else if (e.key === 'Enter') { e.preventDefault(); press('ok'); }
  }

  R.intro = {
    init: function () {
      el.root = $('#intro'); el.keypad = $('#keypad'); el.slots = $('#codeSlots'); el.status = $('#lockStatus');
      el.count = $('#codeCount'); el.mode = $('#codeMode'); el.box = $('.code-box'); el.foot = $('#lockFoot'); el.bar = $('#codeBar');
      $('#introEmblem').innerHTML = window.RSSEmblem.svg({ ink: '#050607' });
      // 주사선이 문장 모양 안에서만 빛나도록 마스크 지정
      var mask = window.RSSEmblem.svg({ mode: 'solid', color: '#000', ink: '#000' });
      $('#introEmblem').style.setProperty('--em-mask', 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(mask) + '")');
      buildKeypad();
      R.fx.hex();
      // 화면 켜짐 잔상 노이즈 텍스처 (한 번만 생성)
      try {
        var nc = document.createElement('canvas'); nc.width = nc.height = 160;
        var ng = nc.getContext('2d'), id = ng.createImageData(160, 160);
        for (var i = 0; i < id.data.length; i += 4) { var v = Math.random() * 255; id.data[i] = v; id.data[i + 1] = v * .72; id.data[i + 2] = v * .3; id.data[i + 3] = Math.random() < .5 ? 255 : 0; }
        ng.putImageData(id, 0, 0);
        $('#power').style.setProperty('--noise', 'url(' + nc.toDataURL('image/png') + ')');
      } catch (e) {}
      document.addEventListener('keydown', onKey);
    },
    /* 인트로를 처음부터 재생하고 잠금 해제되면 done 호출 */
    show: function (done) {
      var seq = ++st.seq, booted = false;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      st.done = done; st.buf = ''; st.first = ''; st.shown = -1; busy(true);
      el.root.hidden = false;
      el.root.classList.remove('out', 'boot', 'power-on', 'powering'); void el.root.offsetWidth;
      el.root.classList.add('power-on', 'powering');
      el.status.innerHTML = ''; el.foot.textContent = '';
      $('#hudVault').textContent = 'SEALED';
      R.fx.globe(true);
      renderSlots();
      R.sound.power();

      // 자가진단(POST) 문구
      var post = $('#post'); post.innerHTML = '';
      var lines = [
        ['R.S.S. ARCHIVE TERMINAL', '  FIRMWARE ' + (R.version || '')],
        ['MEMORY TEST ........... ', 'OK'],
        ['CRYPTO MODULE ......... ', 'AES-256-GCM READY'],
        ['KEY DERIVATION ........ ', 'PBKDF2-SHA256'],
        ['STORAGE ............... ', 'LOCAL · OFFLINE'],
        ['PROJECTION ............ ', 'ONLINE']
      ];
      lines.forEach(function (l, i) {
        setTimeout(function () {
          if (seq !== st.seq || booted) return;
          post.appendChild(h('div', null, h('span', { class: 'dim' }, l[0]), l[1]));
          R.sound.tick();
        }, reduce ? 0 : 380 + i * 150);
      });

      var envP = R.store.load();
      var skip = function (e) { if (e && e.type === 'keydown' && e.repeat) return; boot(); };
      document.addEventListener('keydown', skip, true);
      el.root.addEventListener('pointerdown', skip);
      setTimeout(boot, reduce ? 100 : 1700);

      function boot() {
        if (seq !== st.seq || booted) return;
        booted = true;
        document.removeEventListener('keydown', skip, true);
        el.root.removeEventListener('pointerdown', skip);
        el.root.classList.add('boot');
        setTimeout(function () { if (seq === st.seq) el.root.classList.remove('powering'); }, 900);
        envP.then(function (env) {
          setTimeout(function () {
            if (seq !== st.seq) return;
            busy(false);
            if (!env) { st.envelope = null; firstRun(); return; }
            if (env.broken || !env.ct || !env.salt || !env.iv) {
              st.mode = 'broken'; $('#hudVault').textContent = 'CORRUPTED';
              say('보관소 파일 손상 감지. 초기화가 필요합니다.', true);
              showForgot(); return;
            }
            st.envelope = env; setMode('unlock');
            if (Date.now() < st.lockUntil) { countdown(); return; }
            say('사용자 식별 대기. 접속 코드를 입력하십시오.');
            el.foot.textContent = '숫자 키 입력 가능 · ENTER 인증 · ESC 전체 지움';
            if (st.fails >= 3) showForgot();
          }, reduce ? 0 : 1100);
        });
      }
    }
  };
})();
