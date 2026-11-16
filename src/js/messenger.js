/* 메신저 (msg): 같은 네트워크의 R.S.S. 사용자끼리 대화
   - 서버 없음. Electron 이 UDP 방송으로 패킷을 뿌리고 받음
   - 같은 '채널 코드' 를 넣은 사람끼리만 읽을 수 있게 AES-256-GCM 으로 암호화 (키 = PBKDF2(채널 코드))
   - 대화 내용은 저장하지 않음 (창을 닫거나 잠그면 사라짐)
   - 브라우저 미리보기에서는 같은 브라우저의 다른 탭끼리만 연결(BroadcastChannel) */
(function () {
  'use strict';
  var R = window.RSS, $ = R.$, h = R.h;
  var enc = new TextEncoder(), dec = new TextDecoder();
  var T = function (k, e) { return R.T(k, e); };

  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var bin = atob(s), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  /* 전송로: Electron 이면 UDP, 아니면 BroadcastChannel */
  var bc = null;
  var link = window.rss && window.rss.netStart ? {
    start: function () { return window.rss.netStart(); },
    send: function (t) { return window.rss.netSend(t); },
    stop: function () { return window.rss.netStop(); },
    on: function (fn) { return window.rss.onPacket(fn); }
  } : {
    start: function () { try { bc = new BroadcastChannel('rss-msg'); } catch (e) { return Promise.reject(e); } return Promise.resolve(true); },
    send: function (t) { if (bc) bc.postMessage(t); return Promise.resolve(true); },
    stop: function () { if (bc) bc.close(); bc = null; return Promise.resolve(true); },
    on: function (fn) { var c = bc, hd = function (e) { fn(e.data, 'local'); }; if (c) c.addEventListener('message', hd); return function () { if (c) c.removeEventListener('message', hd); }; }
  };

  var S = { on: false, key: null, tag: '', nick: '', id: '', peers: {}, seen: {}, off: null, hello: 0, sweep: 0, els: null, channel: '' };

  function deriveKey(code) {
    return crypto.subtle.importKey('raw', enc.encode('RSS-MSG::' + code), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('rss-messenger-v1'), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function tagOf(code) { return crypto.subtle.digest('SHA-256', enc.encode('RSS-MSG-TAG::' + code)).then(function (d) { return hex(d).slice(0, 12); }); }

  function seal(obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, S.key, enc.encode(JSON.stringify(obj))).then(function (ct) {
      return JSON.stringify({ a: 'RSSM', v: 1, tag: S.tag, iv: b64(iv), ct: b64(ct) });
    });
  }
  function emit(kind, extra) {
    if (!S.on) return Promise.resolve();
    var o = Object.assign({ k: kind, id: S.id, nick: S.nick, mid: R.uid(), ts: Date.now() }, extra || {});
    return seal(o).then(link.send);
  }
  function onPacket(text) {
    if (!S.on || typeof text !== 'string' || text.length > 60000) return;
    var p; try { p = JSON.parse(text); } catch (e) { return; }
    if (!p || p.a !== 'RSSM' || p.tag !== S.tag) return;      // 다른 채널 · 다른 앱은 무시
    crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, S.key, unb64(p.ct)).then(function (pt) {
      var m = JSON.parse(dec.decode(pt));
      if (!m || !m.mid || S.seen[m.mid]) return;              // 여러 경로로 같은 패킷이 와도 한 번만
      S.seen[m.mid] = 1;
      if (m.id === S.id) return;
      var nick = String(m.nick || '???').slice(0, 24);
      var known = !!S.peers[m.id];
      S.peers[m.id] = { nick: nick, at: Date.now() };
      if (m.k === 'hello' && !known) { line('sys', fmt(T('{n} 접속', '{n} joined'), nick)); drawPeers(); }
      else if (m.k === 'bye') { delete S.peers[m.id]; line('sys', fmt(T('{n} 퇴장', '{n} left'), nick)); drawPeers(); }
      else if (m.k === 'msg') { if (!known) drawPeers(); line('peer', String(m.text || '').slice(0, 2000), nick, m.ts); R.sound.out(); }
    }).catch(function () { /* 코드가 다르면 복호화 실패 → 무시 */ });
  }
  function fmt(s, n) { return s.replace('{n}', n); }

  function line(kind, text, nick, ts) {
    if (!S.els) return;
    var d = new Date(ts || Date.now()), t = R.p2(d.getHours()) + ':' + R.p2(d.getMinutes());
    var body = h('span', { class: 'mm-t' });
    var row = h('div', { class: 'mm mm-' + kind },
      h('span', { class: 'mm-ts' }, t),
      kind === 'sys' ? null : h('span', { class: 'mm-who' }, kind === 'me' ? (S.nick + ' ▸') : (nick + ' ▸')),
      body);
    S.els.log.appendChild(row);
    R.decode(body, text, { speed: 12 });
    S.els.log.scrollTop = S.els.log.scrollHeight;
  }
  function drawPeers() {
    if (!S.els) return;
    var now = Date.now(), list = S.els.peers; list.innerHTML = '';
    Object.keys(S.peers).forEach(function (id) { if (now - S.peers[id].at > 15000) delete S.peers[id]; });
    var ids = Object.keys(S.peers);
    list.appendChild(h('div', { class: 'mp me' }, h('i'), S.nick + T(' (나)', ' (you)')));
    ids.forEach(function (id) { list.appendChild(h('div', { class: 'mp' }, h('i'), S.peers[id].nick)); });
    S.els.count.textContent = (ids.length + 1) + T('명 접속', ' online');
  }

  function connect(nick, code) {
    if (!nick || !code) return Promise.reject(new Error(T('호출부호와 채널 코드를 모두 입력하십시오.', 'Enter both callsign and channel code.')));
    S.nick = nick.slice(0, 24); S.channel = code; S.id = R.uid(); S.peers = {}; S.seen = {};
    return Promise.all([deriveKey(code), tagOf(code)]).then(function (r) {
      S.key = r[0]; S.tag = r[1];
      return link.start();
    }).then(function () {
      S.on = true;
      S.off = link.on(onPacket);
      emit('hello');
      S.hello = setInterval(function () { emit('hello'); }, 4000);
      S.sweep = setInterval(drawPeers, 5000);
      R.log('SEC', T('메신저 채널 접속 · ', 'Messenger channel joined · ') + S.tag.slice(0, 6));
    });
  }
  function disconnect() {
    if (!S.on) return;
    emit('bye');
    S.on = false;
    clearInterval(S.hello); clearInterval(S.sweep);
    if (S.off) S.off(); S.off = null;
    setTimeout(function () { link.stop(); }, 200);
    S.key = null; S.peers = {};
  }
  R.msgDisconnect = disconnect;

  /* 메신저 창 (모듈) */
  R.views.msg = function (root) {
    var wrap = h('div', { class: 'msgr' });
    root.appendChild(wrap);
    var setup = h('form', { class: 'msg-setup', onsubmit: function (e) { e.preventDefault(); go(); } });
    var nick = h('input', { class: 'input', maxlength: '24', placeholder: T('호출부호 (예: RAVEN)', 'Callsign (e.g. RAVEN)'), value: (function () { try { return localStorage.getItem('rss-nick') || ''; } catch (e) { return ''; } })() });
    var code = h('input', { class: 'input', type: 'password', maxlength: '64', placeholder: T('채널 코드 (같은 코드끼리만 대화)', 'Channel code (only matching codes can talk)'), autocomplete: 'off' });
    var err = h('p', { class: 'hint', style: { color: 'var(--accent-hi)', minHeight: '18px' } });
    setup.appendChild(h('div', { class: 'msg-intro' },
      h('h3', null, T('보안 메신저', 'Secure messenger')),
      h('p', null, T('같은 네트워크(같은 공유기 · 와이파이)에 있는 R.S.S. 사용자와 대화합니다. 같은 채널 코드를 넣은 사람끼리만 내용을 읽을 수 있으며, 대화는 저장되지 않습니다.',
        'Talk with R.S.S. users on the same network (same router / Wi-Fi). Only people with the same channel code can read messages. Nothing is stored.'))));
    setup.appendChild(h('label', { class: 'field' }, h('span', null, 'CALLSIGN'), nick));
    setup.appendChild(h('label', { class: 'field' }, h('span', null, 'CHANNEL CODE'), code));
    setup.appendChild(h('button', { class: 'btn primary', type: 'submit' }, T('채널 접속', 'Join channel')));
    setup.appendChild(err);
    setup.appendChild(h('p', { class: 'hint' }, T('처음 접속할 때 Windows 방화벽 허용 창이 뜨면 "허용" 을 눌러야 다른 PC 와 연결됩니다.', 'If Windows Firewall asks on first join, click "Allow" so other PCs can connect.')));

    var room = h('div', { class: 'msg-room', hidden: true });
    var peers = h('div', { class: 'msg-peers' }), count = h('span', { class: 'msg-count' });
    var log = h('div', { class: 'msg-log' });
    var inp = h('input', { class: 'term-in msg-in', maxlength: '1000', placeholder: T('메시지 · Enter 전송', 'Message · Enter to send') });
    var sendForm = h('form', { class: 'msg-line', onsubmit: function (e) {
      e.preventDefault();
      var v = inp.value.trim(); if (!v || !S.on) return;
      inp.value = ''; R.sound.stroke('enter');
      line('me', v); emit('msg', { text: v });
    } }, h('span', { class: 'term-ps' }, '▸'), inp);
    room.appendChild(h('aside', { class: 'msg-side' }, h('div', { class: 'label' }, 'ONLINE'), count, peers,
      h('button', { class: 'btn ghost', type: 'button', style: { marginTop: 'auto' }, onclick: function () { disconnect(); room.hidden = true; setup.hidden = false; S.els = null; } }, T('채널 나가기', 'Leave channel'))));
    room.appendChild(h('section', { class: 'msg-main' }, log, sendForm));
    wrap.appendChild(setup); wrap.appendChild(room);

    function go() {
      err.textContent = '';
      try { localStorage.setItem('rss-nick', nick.value.trim()); } catch (e) {}
      connect(nick.value.trim(), code.value).then(function () {
        S.els = { log: log, peers: peers, count: count };
        setup.hidden = true; room.hidden = false;
        line('sys', T('채널 접속 완료 · 같은 코드의 사용자를 기다리는 중', 'Channel joined · waiting for others with the same code'));
        drawPeers(); inp.focus();
      }, function (e) { err.textContent = (e && e.message) || T('접속 실패', 'Connection failed'); });
    }
    if (S.on) { S.els = { log: log, peers: peers, count: count }; setup.hidden = true; room.hidden = false; drawPeers(); }
    setTimeout(function () { (S.on ? inp : nick).focus(); }, 300);
    // 창을 닫으면 채널에서도 나감 (대화는 남기지 않음)
    return function () { disconnect(); S.els = null; };
  };
})();
