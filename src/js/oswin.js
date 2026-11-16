/* OS 창: "OS" 를 입력하면 Person Register(가상 회사 PC 화면)를 떠 있는 창으로 띄움
   - 내용: apps/os/person-register.html (사용자가 만든 페이지를 그대로 넣음)
   - 상단 바로 이동 · 네 변/모서리로 크기 조절 · 상단 바 두 번 누르면 최대화 */
(function () {
  'use strict';
  var R = window.RSS, h = R.h, el = null;
  R.oswin = {
    isOpen: function () { return !!el; },
    open: function () {
      if (el) { R.win.front(el); return; }
      var frame = h('iframe', { class: 'xwin-view', src: 'apps/os/person-register.html', title: 'Person Register', allow: 'fullscreen; autoplay' });
      var maxBtn = h('button', { class: 'mod-x', type: 'button', title: R.T('최대화', 'Maximize'), onclick: function () { R.oswin.toggleFull(); } }, '▢');
      var bar = h('div', { class: 'win-h xwin-h' },
        h('span', { class: 'win-k' }, 'OS'),
        h('span', { class: 'win-t' }, 'Person Register'),
        h('span', { class: 'win-s' }, R.T('상단 바: 이동 · 두 번 누르면 최대화 · 가장자리: 크기 조절', 'Drag bar to move · double-click to maximize · drag edges to resize')),
        maxBtn,
        h('button', { class: 'mod-x', type: 'button', 'aria-label': R.T('닫기', 'Close'), onclick: function () { R.oswin.close(true); } }, '✕'));
      el = h('section', { class: 'xwin', role: 'dialog', 'aria-label': 'Person Register' }, bar, h('div', { class: 'xwin-body' }, frame));
      document.getElementById('app').appendChild(el);
      R.win.make(el, bar, function () { R.oswin.toggleFull(); });
      el.classList.add('opening');
      R.fx.rainOpen(el);
      R.log('SYS', R.T('OS 창 열기 · Person Register', 'OS window opened · Person Register'));
    },
    close: function (byUser) {
      if (!el) return;
      el.remove(); el = null;
      if (byUser) R.log('SYS', R.T('OS 창 닫기', 'OS window closed'));
      if (R.term) R.term.focus();
    },
    toggleFull: function () { if (!el) return false; el.classList.toggle('full'); R.sound.out(); return true; }
  };
})();
