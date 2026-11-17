/* 오프라인 설치 지원: 앱 파일을 휴대폰에 보관해 인터넷 없이도 열리게 함.
   새 버전을 배포할 때 VERSION 을 올리면 다음 접속 때 새 파일로 바뀜 */
var VERSION = 'rss-mobile-2';
var FILES = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'js/emblem.js', 'js/core.js', 'js/market.js', 'js/work.js', 'js/invest.js', 'js/app.js',
  'fonts/PretendardVariable.woff2', 'fonts/D2Coding.woff2', 'fonts/GalmuriMono11.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
// 먼저 인터넷에서 새 파일을 받고, 안 되면 보관한 파일 사용
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
