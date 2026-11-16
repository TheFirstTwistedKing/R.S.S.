/* 마우스 커서: 주황색 별이 계속 회전. 버튼·글 입력란 위에서도 모양은 그대로 두고 회전 속도와 크기만 바뀜 */
(function () {
  'use strict';
  var S = window.RSSStar;
  if (!S || !window.matchMedia('(pointer: fine)').matches) return;   // 터치 기기에서는 사용하지 않음
  var CX = 150.7, CY = 170.5;   // 별 무게중심 = 회전축 = 클릭 지점

  var el = document.createElement('div');
  el.className = 'cur off';
  el.style.transform = 'translate3d(-100px,-100px,0)';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="cur-rot" style="transform-origin:' + (CX / S.w * 100) + '% ' + (CY / S.h * 100) + '%">' +
    '<svg viewBox="0 0 ' + S.w + ' ' + S.h + '"><path fill-rule="evenodd" d="' + S.d + '"/></svg></div>';

  var x = -100, y = -100, raf = 0;
  function place() { raf = 0; el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }
  var HOT = 'a, button, input, textarea, select, label, [role="button"], .t-link, .key, .item, .ev-card, .redact, .t-red, canvas, .tab';

  function init() {
    document.body.appendChild(el);
    document.documentElement.classList.add('has-cur');
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') { el.classList.add('off'); return; }
      el.classList.remove('off');
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(place);
      var t = e.target.closest ? e.target.closest(HOT) : null;
      el.classList.toggle('hot', !!t);
      el.classList.toggle('text', !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')));
    }, { passive: true });
    document.addEventListener('pointerdown', function () { el.classList.add('down'); }, { passive: true });
    document.addEventListener('pointerup', function () { el.classList.remove('down'); }, { passive: true });
    // 앱 안에 띄운 페이지(OS 창 등)에서 보내 온 마우스 위치: 그 창의 위치만큼 옮겨서 같은 별 커서로 표시
    window.addEventListener('message', function (e) {
      var d = e.data; if (!d || d.rss !== 'cur') return;
      if (d.down != null) { el.classList.toggle('down', !!d.down); return; }
      var fr = Array.prototype.find.call(document.querySelectorAll('iframe'), function (f) { return f.contentWindow === e.source; });
      if (!fr) return;
      var r = fr.getBoundingClientRect();
      el.classList.remove('off');
      x = r.left + d.x * (r.width / (fr.clientWidth || r.width)); y = r.top + d.y * (r.height / (fr.clientHeight || r.height));
      if (!raf) raf = requestAnimationFrame(place);
      el.classList.toggle('hot', !!d.hot);
      el.classList.toggle('text', !!d.text);
    });
    document.documentElement.addEventListener('mouseleave', function () { el.classList.add('off'); });
    document.documentElement.addEventListener('mouseenter', function () { el.classList.remove('off'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
