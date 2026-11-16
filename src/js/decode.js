/* 글자 해독 연출 (참고 영상 방식)
   1) 글자 자리에 빗금 막대가 먼저 깔림
   2) 왼쪽부터 글자가 확정되고, 확정된 글자 바로 뒤에 깨진 기호 꼬리(0 1 < > / \ ▄ ▀ ▒)가 따라붙음
   3) 꼬리가 끝까지 밀려나면 원문 완성. 여러 줄은 위에서 아래로 차례로 진행
   모든 요소를 하나의 requestAnimationFrame 루프로 처리해 프레임 부담을 줄임 */
(function () {
  'use strict';
  var R = window.RSS;
  var GLYPH = '01<>/\\#%▄▀▒░▚▞';
  var TAIL = 6;
  var jobs = [], raf = 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rnd() { return GLYPH[(Math.random() * GLYPH.length) | 0]; }

  function frame(now) {
    raf = 0;
    for (var i = jobs.length - 1; i >= 0; i--) {
      var j = jobs[i];
      if (now < j.start) continue;
      if (!j.begun) { j.begun = true; j.el.classList.remove('dc-wait'); j.el.classList.add('dc-run'); }
      var p = Math.min(1, (now - j.start) / j.dur);
      var done = Math.floor(p * j.chars.length);
      if (p >= 1) {
        j.el.classList.remove('dc-run');
        j.el.textContent = j.text;
        jobs.splice(i, 1);
        if (j.cb) j.cb();
        continue;
      }
      // 30fps 정도로만 글자 갱신 (기호가 너무 빨리 바뀌어 번쩍이지 않도록)
      if (now - j.last < 33) continue;
      j.last = now;
      var tail = '', n = Math.min(TAIL, j.chars.length - done);
      for (var k = 0; k < n; k++) tail += j.chars[done + k] === ' ' ? ' ' : rnd();
      j.head.nodeValue = j.chars.slice(0, done).join('');
      j.tailEl.textContent = tail;
      if (!j.attached) { j.el.textContent = ''; j.el.appendChild(j.head); j.el.appendChild(j.tailEl); j.attached = true; }
    }
    if (jobs.length) raf = requestAnimationFrame(frame);
  }

  /* el 의 글자를 text 로 해독. opts: { delay(ms), speed(ms/글자), cb } */
  R.decode = function (el, text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    for (var i = jobs.length - 1; i >= 0; i--) if (jobs[i].el === el) jobs.splice(i, 1);
    if (reduce || !text.trim()) { el.textContent = text; if (opts.cb) opts.cb(); return; }
    var chars = Array.from(text);
    var dur = Math.max(220, Math.min(1100, chars.length * (opts.speed || 22)));
    el.textContent = text;              // 빗금 막대 폭을 원문 길이에 맞춤
    el.classList.add('dc-wait');
    var tailEl = document.createElement('span'); tailEl.className = 'dc-tail';
    jobs.push({ el: el, text: text, chars: chars, start: performance.now() + (opts.delay || 0), dur: dur, last: 0, head: document.createTextNode(''), tailEl: tailEl, cb: opts.cb });
    if (!raf) raf = requestAnimationFrame(frame);
  };

  /* 컨테이너 안의 '글자만 가진' 요소들을 위→아래 순서로 차례 해독 */
  R.decodeTree = function (root, selector, step) {
    if (!root) return;
    var els = R.$$(selector || '[data-dc]', root).filter(function (e) {
      return e.childElementCount === 0 && e.textContent.trim() && !e.closest('.dc-skip');
    });
    els.forEach(function (e, i) { R.decode(e, e.textContent, { delay: Math.min(i * (step || 45), 900) }); });
  };

  /* 결과가 끝날 때 Promise 로 받기 */
  R.decodeP = function (el, text, opts) {
    return new Promise(function (res) { opts = opts || {}; var cb = opts.cb; opts.cb = function () { if (cb) cb(); res(); }; R.decode(el, text, opts); });
  };
})();
