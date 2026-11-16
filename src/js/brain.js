/* Control 학습: 사용자가 가르친 말을 기억하고 다음부터 그대로 처리함.
   - 저장: 보관소(db.brain) 안에 암호화되어 함께 저장 → 암호화 백업에도 그대로 들어감
   - 규칙 하나 = { say: 사용자가 쓰는 말, act: 실제로 처리할 명령 }
   - 다른 PC 로 옮기기: 학습 파일(.rssbrain, 공유 코드로 암호화) 내보내기 / 가져오기(합치기)
   - 앱에 기본으로 넣고 싶은 규칙은 learned.js 의 RSSLearned 에 적으면 모든 PC 에 들어감
   인터넷 · 외부 AI 없이 앱 안에서만 동작함 */
(function () {
  'use strict';
  var R = window.RSS;

  /* 말 비교용 열쇠: 소문자 · 공백/문장부호 제거 · 끝의 존댓말 꼬리 제거 */
  var TAIL = /(해\s*줄래|해\s*주세요|해\s*줘요|해\s*줘|해\s*봐|주세요|줄래|줘요|줘|해요|해라|하자|해|요|좀)$/;
  R.brainKey = function (t) {
    var k = String(t || '').toLowerCase().replace(/[\s"'“”‘’`.,!?~·…:;()\[\]{}<>]+/g, '');
    for (var i = 0; i < 2; i++) { var n = k.replace(TAIL, ''); if (n === k || n.length < 2) break; k = n; }
    return k;
  };
  // 편집 거리 (오타를 조금 봐주기 위함)
  function lev(a, b) {
    a = Array.from(a); b = Array.from(b);
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  R.emptyBrain = function () { return { v: 1, name: '', rules: [] }; };
  R.normBrain = function (b) {
    var o = R.emptyBrain();
    if (!b || typeof b !== 'object') return o;
    o.name = typeof b.name === 'string' ? b.name.slice(0, 24) : '';
    var seen = {};
    o.rules = (Array.isArray(b.rules) ? b.rules : []).filter(function (r) { return r && r.say && r.act; }).map(function (r) {
      return { id: String(r.id || R.uid()), say: String(r.say).slice(0, 120), act: String(r.act).slice(0, 200), n: Math.max(0, +r.n || 0), t: +r.t || Date.now(), src: r.src === 'import' ? 'import' : 'user' };
    }).filter(function (r) { var k = R.brainKey(r.say); if (!k || seen[k]) return false; seen[k] = 1; return true; }).slice(0, 500);
    return o;
  };

  var brain = function () { var db = R.store && R.store.db; if (!db) return null; if (!db.brain) db.brain = R.emptyBrain(); return db.brain; };
  var builtin = function () { return ((window.RSSLearned && window.RSSLearned.rules) || []).map(function (r) { return { id: 'b-' + R.brainKey(r.say), say: r.say, act: r.act, n: 0, src: 'builtin' }; }); };

  R.brain = {
    get: brain,
    /* 사용자 규칙 + 앱 기본 규칙 (같은 말이면 사용자 규칙이 이김) */
    all: function () {
      var b = brain(), mine = b ? b.rules : [], keys = {};
      mine.forEach(function (r) { keys[R.brainKey(r.say)] = 1; });
      return mine.concat(builtin().filter(function (r) { return !keys[R.brainKey(r.say)]; }));
    },
    /* 정확히 같은 말 (열쇠 기준) */
    exact: function (t) {
      var k = R.brainKey(t); if (!k) return null;
      var list = R.brain.all();
      for (var i = 0; i < list.length; i++) if (R.brainKey(list[i].say) === k) return list[i];
      return null;
    },
    /* 비슷한 말 (오타 · 띄어쓰기 차이): 열쇠 길이 3 이상, 다른 정도 20% 이하 */
    near: function (t) {
      var k = R.brainKey(t); if (Array.from(k).length < 3) return null;
      var best = null, bestD = 1e9;
      R.brain.all().forEach(function (r) {
        var rk = R.brainKey(r.say), L = Math.max(Array.from(k).length, Array.from(rk).length);
        if (Math.abs(Array.from(k).length - Array.from(rk).length) > L * 0.25) return;
        var d = lev(k, rk);
        if (d / L <= 0.2 && d < bestD) { best = r; bestD = d; }
      });
      return best;
    },
    teach: function (say, act) {
      var b = brain(); if (!b) return null;
      var k = R.brainKey(say);
      var old = b.rules.filter(function (r) { return R.brainKey(r.say) === k; })[0];
      if (old) { old.act = act; old.t = Date.now(); R.store.save(); return { rule: old, updated: true }; }
      var r = { id: R.uid(), say: say, act: act, n: 0, t: Date.now(), src: 'user' };
      b.rules.push(r); if (b.rules.length > 500) b.rules.shift();
      R.store.save();
      return { rule: r, updated: false };
    },
    used: function (r) { if (r.src === 'builtin') return; r.n = (r.n || 0) + 1; R.store.save(); },
    forget: function (r) { var b = brain(); if (!b) return false; var i = b.rules.indexOf(r); if (i < 0) return false; b.rules.splice(i, 1); R.store.save(); return true; },
    wipe: function () { var b = brain(); if (!b) return 0; var n = b.rules.length; b.rules = []; b.name = ''; R.store.save(); return n; },
    setName: function (n) { var b = brain(); if (!b) return; b.name = n; R.store.save(); },
    name: function () { var b = brain(); return b ? b.name : ''; },

    /* 다른 PC 로 옮기기: 공유 코드로 암호화한 학습 파일 */
    exportFile: function () {
      var b = brain(); if (!b || !b.rules.length) return Promise.resolve('empty');
      return R.ui.codePrompt(R.T('학습 내보내기', 'Export learning'), R.T('학습 파일을 잠글 공유 코드를 정해 주십시오 (숫자 4~8자리). 다른 PC 에서 가져올 때 이 코드가 필요합니다.', 'Choose a share code (4–8 digits). The other PC needs it to import.')).then(function (code) {
        if (code == null) return null;
        if (!/^\d{4,8}$/.test(code)) throw new Error(R.T('공유 코드는 숫자 4~8자리입니다', 'The share code must be 4–8 digits'));
        return R.crypto.newKey(code).then(function (k) {
          return R.crypto.seal(k, { app: 'RSS-BRAIN', v: 1, rules: b.rules.map(function (r) { return { say: r.say, act: r.act }; }) });
        }).then(function (text) {
          var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
          return R.bridge.saveBackup('rss-control-learning-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.rssbrain', text);
        }).then(function (path) { return path ? b.rules.length : null; });
      });
    },
    importFile: function () {
      return R.bridge.openBackup().then(function (text) {
        if (!text) return null;
        var env; try { env = JSON.parse(text); } catch (e) { throw new Error(R.T('읽을 수 없는 파일입니다', 'Unreadable file')); }
        if (!env || !env.ct) throw new Error(R.T('학습 파일이 아닙니다', 'Not a learning file'));
        return R.ui.codePrompt(R.T('학습 가져오기', 'Import learning'), R.T('학습 파일을 내보낼 때 정한 공유 코드를 입력하십시오.', 'Enter the share code chosen when the file was exported.')).then(function (code) {
          if (code == null) return null;
          return R.crypto.keyFor(code, env).then(function (k) { return R.crypto.open(k, env); }, function () { throw new Error('bad'); })
            .catch(function () { throw new Error(R.T('공유 코드가 맞지 않습니다', 'Wrong share code')); })
            .then(function (data) {
              if (!data || data.app !== 'RSS-BRAIN') throw new Error(R.T('학습 파일이 아닙니다', 'Not a learning file'));
              var b = brain(), keys = {}, added = 0, changed = 0;
              b.rules.forEach(function (r) { keys[R.brainKey(r.say)] = r; });
              (data.rules || []).forEach(function (x) {
                if (!x || !x.say || !x.act) return;
                var k = R.brainKey(x.say), have = keys[k];
                if (have) { if (have.act !== x.act) { have.act = String(x.act); changed++; } return; }
                var r = { id: R.uid(), say: String(x.say).slice(0, 120), act: String(x.act).slice(0, 200), n: 0, t: Date.now(), src: 'import' };
                b.rules.push(r); keys[k] = r; added++;
              });
              R.store.save();
              return { added: added, changed: changed };
            });
        });
      });
    }
  };
})();
