/* 인트로 = 잠금 화면. 앱을 켤 때마다, 잠근 뒤 다시 들어올 때마다 처음부터 재생된다. (다시보기 버튼 없음) */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var MIN = 4, MAX = 8, MAX_FAIL = 5;

  var el = {}, st = { mode: 'unlock', buf: '', first: '', fails: 0, busy: false, lockUntil: 0, envelope: null, done: null, typing: 0 };

  function buildKeypad() {
    var pad = el.keypad; pad.innerHTML = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) {
      pad.appendChild(h('button', { class: 'key', 'data-k': d, type: 'button', 'aria-label': d }, d));
    });
    pad.appendChild(h('button', { class: 'key fn', 'data-k': 'clr', type: 'button' }, 'CLR'));
    pad.appendChild(h('button', { class: 'key', 'data-k': '0', type: 'button', 'aria-label': '0' }, '0'));
    pad.appendChild(h('button', { class: 'key fn', 'data-k': 'del', type: 'button', 'aria-label': '지우기' }, 'DEL'));
    var ok = h('button', { class: 'key ok', 'data-k': 'ok', type: 'button', style: { gridColumn: '1 / -1' } }, 'ENTER');
    pad.appendChild(ok);
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('.key'); if (b) press(b.getAttribute('data-k'));
    });
  }

  function renderSlots() {
    var html = '';
    for (var i = 0; i < MAX; i++) {
      var cls = i < st.buf.length ? 'on' : (i === st.buf.length ? 'cur' : '');
      if (i >= MIN && i >= st.buf.length + 1) cls += ' off';
      html += '<div class="slot ' + cls + '"></div>';
    }
    el.slots.innerHTML = html;
    el.count.textContent = st.buf.length + '/' + MAX;
  }

  function say(text, deny) {
    var my = ++st.typing, i = 0;
    el.status.classList.toggle('deny', !!deny);
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.status.innerHTML = R.esc(text) + '<span class="caret"></span>'; return; }
    (function step() {
      if (my !== st.typing) return;
      i = Math.min(text.length, i + 1);
      el.status.innerHTML = R.esc(text.slice(0, i)) + '<span class="caret"></span>';
      if (i % 2 === 0) R.sound.tick();
      if (i < text.length) setTimeout(step, 28);
    })();
  }

  function flashKey(k) {
    var b = el.keypad.querySelector('[data-k="' + k + '"]');
    if (!b) return;
    b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 90);
  }

  function press(k) {
    if (st.busy || st.mode === 'broken') return;
    if (Date.now() < st.lockUntil) return;
    flashKey(k);
    if (/^\d$/.test(k)) {
      if (st.buf.length >= MAX) return;
      st.buf += k; R.sound.key();
    } else if (k === 'del') { st.buf = st.buf.slice(0, -1); R.sound.key(); }
    else if (k === 'clr') { st.buf = ''; R.sound.key(); }
    else if (k === 'ok') { submit(); return; }
    renderSlots();
  }

  function shake() {
    el.box.classList.remove('shake'); void el.box.offsetWidth; el.box.classList.add('shake');
    R.sound.deny();
  }

  function setMode(mode) {
    st.mode = mode; st.buf = ''; renderSlots();
    el.mode.textContent = mode === 'unlock' ? 'ACCESS CODE' : (mode === 'create1' ? 'NEW CODE' : 'CONFIRM CODE');
  }

  function submit() {
    if (st.buf.length < MIN) { shake(); say('코드는 ' + MIN + '~' + MAX + '자리 숫자입니다.', true); return; }
    if (st.mode === 'create1') {
      st.first = st.buf; setMode('create2');
      say('확인을 위해 같은 코드를 한 번 더 입력하십시오.');
      return;
    }
    if (st.mode === 'create2') {
      if (st.buf !== st.first) { shake(); setMode('create1'); say('코드 불일치. 처음부터 다시 설정하십시오.', true); return; }
      busy(true); say('보관소 생성 중 · 암호화 키 생성');
      R.store.create(st.buf).then(grant, function (e) { busy(false); say('생성 실패: ' + e.message, true); });
      return;
    }
    var code = st.buf;
    busy(true); say('VERIFYING · 신원 대조 중');
    R.store.unlock(code, st.envelope).then(grant, function () {
      busy(false); st.fails++; setMode('unlock'); shake();
      if (st.fails >= MAX_FAIL) {
        var wait = 30 * Math.pow(2, st.fails - MAX_FAIL);
        st.lockUntil = Date.now() + wait * 1000;
        countdown();
      } else {
        say('ACCESS DENIED · 코드 불일치 (' + st.fails + '/' + MAX_FAIL + ')', true);
      }
      if (st.fails >= 3) showForgot();
    });
  }

  function countdown() {
    var left = Math.ceil((st.lockUntil - Date.now()) / 1000);
    el.keypad.classList.toggle('busy', left > 0);
    if (left <= 0) { say('잠금 해제. 접속 코드를 입력하십시오.'); return; }
    el.status.classList.add('deny');
    el.status.innerHTML = R.esc('입력 제한 · ' + left + '초 후 재시도') + '<span class="caret"></span>';
    setTimeout(countdown, 1000);
  }

  function busy(v) { st.busy = v; el.keypad.classList.toggle('busy', v); }

  function showForgot() {
    if (el.foot.querySelector('.btn')) return;
    el.foot.innerHTML = '';
    el.foot.appendChild(h('span', null, '코드를 잊으면 기록은 복구할 수 없습니다. '));
    el.foot.appendChild(h('br'));
    el.foot.appendChild(h('button', { class: 'btn danger', type: 'button', style: { marginTop: '8px' }, onclick: wipeAsk }, '보관소 초기화'));
  }

  function wipeAsk() {
    R.ui.confirm('보관소 초기화', '저장된 모든 기록이 영구 삭제되고 새 코드를 설정합니다. 백업 파일이 있다면 이후 보안·백업 메뉴에서 가져올 수 있습니다.', '초기화', true).then(function (ok) {
      if (!ok) return;
      R.bridge.wipeVault().then(function () { st.fails = 0; st.envelope = null; el.foot.textContent = ''; firstRun(); });
    });
  }

  function firstRun() {
    setMode('create1');
    say('신규 단말 감지. 접속 코드 ' + MIN + '~' + MAX + '자리를 설정하십시오.');
    el.foot.textContent = '이 코드로 모든 기록이 암호화됩니다. 분실 시 복구 불가.';
  }

  function grant() {
    busy(true);
    st.fails = 0;
    // 슬롯을 한 칸씩 채우며 승인 표시
    var slots = R.$$('.slot', el.slots);
    slots.forEach(function (s, i) { setTimeout(function () { s.className = 'slot on'; }, i * 35); });
    say('ACCESS GRANTED · 보관소 개방');
    R.sound.grant();
    setTimeout(function () {
      el.root.classList.add('out');
      setTimeout(function () {
        el.root.hidden = true;
        el.root.classList.remove('out', 'boot');
        busy(false);
        var cb = st.done; st.done = null;
        if (cb) cb();
      }, 520);
    }, 900);
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
      el.count = $('#codeCount'); el.mode = $('#codeMode'); el.box = $('.code-box'); el.foot = $('#lockFoot');
      $('#introEmblem').innerHTML = window.RSSEmblem.svg({ cell: 6 });
      buildKeypad();
      document.addEventListener('keydown', onKey);
    },
    /* 인트로를 처음부터 재생하고 잠금 해제되면 done 호출 */
    show: function (done) {
      st.done = done; st.buf = ''; st.first = ''; busy(false);
      el.root.hidden = false;
      el.root.classList.remove('out');
      el.root.classList.remove('boot'); void el.root.offsetWidth; el.root.classList.add('boot');
      el.status.innerHTML = '';
      el.foot.textContent = '키보드 숫자키 입력 가능 · ENTER 확인';
      renderSlots();
      busy(true);
      R.store.load().then(function (env) {
        setTimeout(function () {
          busy(false);
          if (!env) { st.envelope = null; firstRun(); return; }
          if (env.broken || !env.ct || !env.salt || !env.iv) {
            st.mode = 'broken';
            say('보관소 파일 손상 감지. 초기화가 필요합니다.', true);
            el.foot.innerHTML = ''; showForgot();
            return;
          }
          st.envelope = env; setMode('unlock');
          if (Date.now() < st.lockUntil) { countdown(); return; }
          say('요원 식별 대기. 접속 코드를 입력하십시오.');
          if (st.fails >= 3) showForgot();
        }, 1100); // 문장이 펼쳐진 뒤 안내 시작
      });
    }
  };
})();
