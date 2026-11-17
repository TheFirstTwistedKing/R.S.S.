/* 떠 있는 창 공통 조작 (캠 창)
   - 상단 바를 잡고 끌면 이동, 상단 바 두 번 누르면 최대화 ↔ 원래 크기
   - 네 변(좌 · 우 · 상 · 하)과 네 모서리를 잡고 끌면 크기 조절
   - 누른 창이 맨 앞으로 옴
   - 폭이 좁은 화면(휴대폰)에서는 창이 화면에 맞춰 고정되므로 끌기 · 크기 조절을 쓰지 않음 */
(function () {
  'use strict';
  var R = window.RSS;
  var MIN_W = 320, MIN_H = 220, Z = 45, top = Z;
  var narrow = function () { return innerWidth < 700; };
  var bandTop = function () { return parseFloat(getComputedStyle(document.body).getPropertyValue('--bn')) || 0; };

  function front(el) { el.style.zIndex = String(++top); }

  /* 처음 끌 때 CSS 위치(오른쪽 위 기준 등)를 화면 좌표(left/top/width/height)로 바꿔 고정 */
  function pin(el) {
    if (el.dataset.pinned) return;
    var r = el.getBoundingClientRect();
    el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    el.style.width = r.width + 'px'; el.style.height = r.height + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.dataset.pinned = '1';
  }
  function clamp(el) {
    var r = el.getBoundingClientRect(), t = bandTop();
    var x = Math.min(Math.max(r.left, 60 - r.width), innerWidth - 60);   // 최소 60px 은 화면 안에 남김
    var y = Math.min(Math.max(r.top, t), innerHeight - 40);              // 상단 바는 항상 잡을 수 있게
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }

  function drag(el, e, mode) {
    if (narrow() || el.classList.contains('full') || e.button !== 0) return;
    e.preventDefault();
    pin(el); front(el);
    var sx = e.clientX, sy = e.clientY, r0 = el.getBoundingClientRect(), t = bandTop();
    var cap = e.target; try { cap.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('win-dragging');      // 창 안 iframe 이 마우스를 가로채지 않게
    el.classList.add('dragging');
    function move(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy, L = r0.left, T = r0.top, W = r0.width, H = r0.height;
      if (mode === 'move') { L += dx; T += dy; }
      else {
        if (mode.indexOf('e') >= 0) W = Math.max(MIN_W, Math.min(r0.width + dx, innerWidth - r0.left));
        if (mode.indexOf('s') >= 0) H = Math.max(MIN_H, Math.min(r0.height + dy, innerHeight - r0.top));
        if (mode.indexOf('w') >= 0) { var nw = Math.max(MIN_W, Math.min(r0.width - dx, r0.right)); L = r0.right - nw; W = nw; }
        if (mode.indexOf('n') >= 0) { var nh = Math.max(MIN_H, Math.min(r0.height - dy, r0.bottom - t)); T = r0.bottom - nh; H = nh; }
      }
      el.style.left = L + 'px'; el.style.top = T + 'px'; el.style.width = W + 'px'; el.style.height = H + 'px';
    }
    function up() {
      cap.removeEventListener('pointermove', move); cap.removeEventListener('pointerup', up); cap.removeEventListener('pointercancel', up);
      document.body.classList.remove('win-dragging'); el.classList.remove('dragging');
      if (mode === 'move') clamp(el);
      window.dispatchEvent(new Event('resize'));       // 창 안 화면(캠 영상 등)이 새 크기에 맞추도록
    }
    cap.addEventListener('pointermove', move); cap.addEventListener('pointerup', up); cap.addEventListener('pointercancel', up);
  }

  R.win = {
    /* el: 창 요소, handle: 상단 바 요소, onMax: 최대화 전환 함수(없으면 'full' 클래스 전환) */
    make: function (el, handle, onMax) {
      el.classList.add('fwin');
      front(el);
      el.addEventListener('pointerdown', function () { front(el); }, true);
      handle.addEventListener('pointerdown', function (e) { if (e.target.closest('button, a, input')) return; drag(el, e, 'move'); });
      handle.addEventListener('dblclick', function (e) { if (e.target.closest('button')) return; if (onMax) onMax(); else el.classList.toggle('full'); });
      ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (d) {
        var g = document.createElement('i');
        g.className = 'rz rz-' + d; g.setAttribute('aria-hidden', 'true');
        g.addEventListener('pointerdown', function (e) { drag(el, e, d); });
        el.appendChild(g);
      });
    },
    front: front
  };

  // 브라우저 창 크기가 바뀌면 떠 있는 창이 화면 밖으로 사라지지 않게
  addEventListener('resize', function () {
    document.querySelectorAll('.fwin[data-pinned]').forEach(function (el) {
      if (el.classList.contains('dragging')) return;
      if (narrow()) { ['left', 'top', 'width', 'height', 'right', 'bottom'].forEach(function (k) { el.style[k] = ''; }); delete el.dataset.pinned; return; }   // 휴대폰 크기면 CSS 배치로 되돌림
      clamp(el);
    });
  });
})();
