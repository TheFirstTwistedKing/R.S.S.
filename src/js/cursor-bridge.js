/* 앱 안에 띄운 페이지(CCTV 감시실 등)에서도 앱의 별 커서를 그대로 쓰게 하는 연결 스크립트
   - 이 페이지의 기본 커서를 숨기고, 마우스 위치 · 누름 상태를 앱(부모 창)에 알림
   - 앱이 아닌 곳에서 이 페이지를 따로 열면(부모 창 없음) 아무것도 하지 않음 */
(function () {
  'use strict';
  if (window.parent === window || !window.matchMedia('(pointer: fine)').matches) return;
  var HOT = 'a, button, input, textarea, select, label, [role="button"], .tile';
  var st = document.createElement('style');
  st.textContent = 'html, html * { cursor: none !important; }';
  (document.head || document.documentElement).appendChild(st);
  var post = function (o) { o.rss = 'cur'; window.parent.postMessage(o, '*'); };
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var t = e.target && e.target.closest ? e.target.closest(HOT) : null;
    post({ x: e.clientX, y: e.clientY, hot: !!t, text: !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) });
  }, { passive: true, capture: true });
  document.addEventListener('pointerdown', function () { post({ down: true }); }, { passive: true, capture: true });
  document.addEventListener('pointerup', function () { post({ down: false }); }, { passive: true, capture: true });
})();
