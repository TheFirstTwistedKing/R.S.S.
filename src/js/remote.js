/* Leviathan Registry → Judgement Operation 에서 승인된 인물 문서를 받아 아카이브에 넣음
   - Firestore archive (누구나 읽기 가능) 를 앱을 켤 때와 10분마다 받아 옴 · 로그인 필요 없음
   - 인터넷이 없을 때를 위해 마지막으로 받은 목록을 이 컴퓨터에 보관 */
(function () {
  'use strict';
  var R = window.RSS, FB = window.RSSFB, SC = window.RSSSchema, KEY = 'rss-remote-archive';
  if (!FB || !SC) return;
  function apply(docs) {
    docs = docs.slice().sort(function (a, b) { return (a.approvedAt || 0) - (b.approvedAt || 0); });
    window.RSSRemote = docs.map(function (d, i) { return SC.toEntity(d, 101 + i); });
    R.resetLore();
  }
  try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.docs) apply(c.docs); } catch (e) {}
  var sig = function (docs) { return docs.map(function (d) { return d.id + ':' + (d.approvedAt || 0); }).sort().join(','); };
  function sync() {
    FB.list(null, 'archive').then(function (docs) {
      var old = null; try { old = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      if (old && old.docs && sig(old.docs) === sig(docs)) return;
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), docs: docs })); } catch (e) {}
      apply(docs);
      if (R.store && R.store.db) R.log('SYS', R.T('아카이브 동기화 · 등록 문서 ', 'Archive synced · registered ') + docs.length + R.T('건', ''));
    }, function (e) { console.warn('archive sync', e.message); });
  }
  setTimeout(sync, 1500);
  setInterval(sync, 600000);
  R.syncArchive = sync;
})();
