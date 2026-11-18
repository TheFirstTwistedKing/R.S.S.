/* 새 버전 알림 (R.S.S. 데스크톱 · R.S.S. Mobile · Leviathan Registry · Judgement Operation 공용)
   - 앱을 켤 때 GitHub Releases 에서 최신 버전을 한 번 확인 → 지금 버전보다 높으면 아래쪽에 안내 띄움
   - 자동으로 받거나 설치하지 않음. "받기" 를 누르면 다운로드 주소를 기본 브라우저로 엶
       PC(Electron): 릴리즈 페이지 (설치형 · 포터블 중 고르기)
       안드로이드(Capacitor): APK 파일 바로 받기
   - 인터넷이 없거나 GitHub 가 응답하지 않으면 아무것도 띄우지 않음
   사용: RSSUpdate.check({ name, current, tag(없으면 latest), apk, accent, lift(아래 고정 바 높이 px), ready() }) */
(function (root) {
  'use strict';
  var API = 'https://api.github.com/repos/TheFirstTwistedKing/R.S.S./releases/';
  var isApp = !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform());

  function parse(v) { var m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; }
  function newer(a, b) { for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; }

  function open(url) {
    // 안드로이드 앱: 바깥 주소로 이동하면 Capacitor 가 기본 브라우저로 넘김 / PC: 새 창 요청을 Electron 이 기본 브라우저로 넘김
    if (isApp) root.location.href = url; else root.open(url, '_blank', 'noopener');
  }

  function style(accent, lift) {
    if (document.getElementById('rss-upd-css')) return;
    var s = document.createElement('style'); s.id = 'rss-upd-css';
    s.textContent =
      '.rss-upd{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + ' + (18 + (lift || 0)) + 'px);z-index:2147483000;width:min(440px,calc(100vw - 32px));' +
      'transform:translate(-50%,24px);opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1),opacity .3s;' +
      'display:grid;grid-template-columns:1fr auto;gap:4px 14px;align-items:center;padding:14px 14px 14px 18px;' +
      'background:#0B0C0E;color:#E9E4D8;border:1px solid rgba(255,255,255,.12);border-left:3px solid ' + accent + ';' +
      'box-shadow:0 18px 40px rgba(0,0,0,.55);font-family:Pretendard,system-ui,sans-serif}' +
      '.rss-upd.in{transform:translate(-50%,0);opacity:1}' +
      '.rss-upd i{grid-column:1/-1;font:700 10px/1.2 D2Coding,ui-monospace,monospace;font-style:normal;letter-spacing:.24em;color:' + accent + '}' +
      '.rss-upd p{margin:0;font-size:14px;line-height:1.45}.rss-upd p b{font-weight:800}.rss-upd p span{display:block;font-size:12px;color:#9C968A}' +
      '.rss-upd div{display:flex;gap:6px}' +
      '.rss-upd button{min-height:36px;padding:0 14px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#E9E4D8;font-family:inherit;font-size:13px;font-weight:600;line-height:1;cursor:pointer}' +
      '.rss-upd button.go{background:' + accent + ';border-color:' + accent + ';color:#0B0C0E}' +
      '@media (max-width:420px){.rss-upd{grid-template-columns:1fr}.rss-upd div{justify-content:flex-end}}';
    document.head.appendChild(s);
  }

  function show(o, latest, url) {
    style(o.accent || '#FFB020', o.lift);
    var box = document.createElement('div'); box.className = 'rss-upd'; box.setAttribute('role', 'status');
    box.innerHTML = '<i>UPDATE AVAILABLE</i><p><b></b><span></span></p><div><button type="button" class="later">나중에</button><button type="button" class="go">받기</button></div>';
    box.querySelector('b').textContent = o.name + ' v' + latest.join('.') + ' 이 나왔습니다';
    box.querySelector('span').textContent = '지금 버전 v' + o.current + (isApp ? ' · 받은 APK 를 덮어 설치하면 데이터는 유지됩니다' : ' · 새로 설치하면 데이터는 유지됩니다');
    function close() { box.classList.remove('in'); setTimeout(function () { box.remove(); }, 450); }
    box.querySelector('.later').onclick = close;
    box.querySelector('.go').onclick = function () { open(url); close(); };
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('in'); }); });
  }

  function check(o) {
    var cur = parse(o.current);
    if (!cur || !root.fetch) return Promise.resolve(null);
    return fetch(API + (o.tag ? 'tags/' + encodeURIComponent(o.tag) : 'latest'), { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel) return null;
        var latest = parse(/^v\d/.test(rel.tag_name || '') ? rel.tag_name : rel.name);
        if (!latest || !newer(latest, cur)) return null;
        var url = rel.html_url;
        if (isApp && o.apk) (rel.assets || []).forEach(function (a) { if (a.name === o.apk) url = a.browser_download_url; });
        // 인트로 · 잠금 화면이 끝난 뒤에 띄움
        var wait = function () { if (!o.ready || o.ready()) show(o, latest, url); else setTimeout(wait, 1000); };
        wait();
        return latest.join('.');
      })
      .catch(function () { return null; });
  }

  root.RSSUpdate = { check: check, parse: parse, newer: newer };
})(window);
