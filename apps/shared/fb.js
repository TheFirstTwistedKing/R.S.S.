/* Firebase 연결 (Leviathan Registry · Judgement Operation · R.S.S. 공용)
   SDK 없이 REST 로 직접 호출함: Electron(file://) · 안드로이드 앱 · 브라우저 어디서나 똑같이 동작하게
   - 로그인: Registry = 익명(기기마다 하나), Judgement Operation = 이메일 · 비밀번호(관리자 한 명)
   - 데이터: Firestore
       submissions/{id}  제출된 인물 문서 (status: pending · approved · rejected)
       archive/{id}      승인되어 R.S.S. 아카이브에 올라간 문서 (누구나 읽기, 관리자만 쓰기)
   - 아래 설정값은 비밀번호가 아니라 앱에 들어가도 되는 공개 설정값. 접근 제한은 Firestore 보안 규칙이 맡음 */
(function (root) {
  'use strict';
  var CFG = {
    apiKey: 'AIzaSyBVNHAf4sW-RRb4ZMOwPc5qRtDvq-H62qg',
    authDomain: 'rssfinal-7786d.firebaseapp.com',
    projectId: 'rssfinal-7786d'
  };
  var DB = 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents';
  var AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  var TOKEN = 'https://securetoken.googleapis.com/v1/token?key=' + CFG.apiKey;

  /* 오류 문구를 한국어로 */
  var MSG = {
    ADMIN_ONLY_OPERATION: 'Firebase 에서 익명 로그인이 꺼져 있습니다 (Authentication → 로그인 방법 → 익명 사용)',
    OPERATION_NOT_ALLOWED: 'Firebase 에서 이 로그인 방식이 꺼져 있습니다',
    PASSWORD_LOGIN_DISABLED: 'Firebase 에서 이메일/비밀번호 로그인이 꺼져 있습니다',
    INVALID_LOGIN_CREDENTIALS: '이메일 또는 비밀번호가 맞지 않습니다',
    INVALID_PASSWORD: '비밀번호가 맞지 않습니다', EMAIL_NOT_FOUND: '등록되지 않은 이메일입니다',
    TOO_MANY_ATTEMPTS_TRY_LATER: '시도가 너무 많습니다. 잠시 뒤 다시 하십시오',
    PERMISSION_DENIED: '권한이 없습니다 (Firestore 보안 규칙 확인)',
    NOT_FOUND: 'Firestore 데이터베이스가 아직 만들어지지 않았습니다',
    UNAUTHENTICATED: '로그인이 만료되었습니다. 다시 로그인하십시오'
  };
  function err(text, code) {
    var m = text || '';
    var key = Object.keys(MSG).filter(function (k) { return m.indexOf(k) >= 0; })[0];
    if (!key && /Cloud Firestore API has not been used|is disabled/i.test(m)) return new Error('Firestore 가 아직 켜져 있지 않습니다 (Firebase 콘솔 → Firestore Database → 데이터베이스 만들기)');
    if (!key && code === 403) key = 'PERMISSION_DENIED';
    if (!key && code === 401) key = 'UNAUTHENTICATED';
    var e = new Error(key ? MSG[key] : (m || '서버 오류 ' + code)); e.code = key || code; return e;
  }
  function req(url, opt) {
    opt = opt || {};
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { raw: t }; }
        if (!r.ok) {
          var m = (j && j.error && (j.error.message || j.error.status)) || t;
          throw err(m, r.status);
        }
        return j;
      });
    }, function () { throw new Error('인터넷에 연결할 수 없습니다'); });
  }

  /* ── 로그인 (토큰은 기기에 보관, 1시간마다 갱신) ── */
  function Auth(key) { this.key = key; this.s = null; try { this.s = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {} }
  Auth.prototype.save = function (r) {
    this.s = { uid: r.localId || r.user_id, idToken: r.idToken || r.id_token, refresh: r.refreshToken || r.refresh_token, exp: Date.now() + (+(r.expiresIn || r.expires_in || 3600) - 120) * 1000, email: r.email || (this.s && this.s.email) || '' };
    try { localStorage.setItem(this.key, JSON.stringify(this.s)); } catch (e) {}
    return this.s;
  };
  Auth.prototype.out = function () { this.s = null; try { localStorage.removeItem(this.key); } catch (e) {} };
  Auth.prototype.anon = function () {
    var me = this;
    if (me.s) return me.token();
    return req(AUTH + 'signUp?key=' + CFG.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }).then(function (r) { me.save(r); return me.s.idToken; });
  };
  Auth.prototype.password = function (email, pw) {
    var me = this;
    return req(AUTH + 'signInWithPassword?key=' + CFG.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: pw, returnSecureToken: true }) }).then(function (r) { me.save(r); return me.s; });
  };
  Auth.prototype.token = function () {
    var me = this;
    if (!me.s) return Promise.reject(new Error('로그인이 필요합니다'));
    if (Date.now() < me.s.exp) return Promise.resolve(me.s.idToken);
    return req(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(me.s.refresh) })
      .then(function (r) { me.save(r); return me.s.idToken; });
  };

  /* ── Firestore 값 변환 ── */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    var f = {}; Object.keys(v).forEach(function (k) { f[k] = enc(v[k]); }); return { mapValue: { fields: f } };
  }
  function dec(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return +v.integerValue;
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return Date.parse(v.timestampValue);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
    if ('mapValue' in v) return decFields(v.mapValue.fields || {});
    return null;
  }
  function decFields(f) { var o = {}; Object.keys(f || {}).forEach(function (k) { o[k] = dec(f[k]); }); return o; }
  function fields(o) { var f = {}; Object.keys(o).forEach(function (k) { f[k] = enc(o[k]); }); return f; }
  function docOut(d) { var o = decFields(d.fields); o.id = d.name.split('/').pop(); o._path = d.name; return o; }

  function hdr(tok) { var h = { 'Content-Type': 'application/json' }; if (tok) h.Authorization = 'Bearer ' + tok; return h; }
  var FB = {
    CFG: CFG,
    Auth: Auth,
    /* 새 문서 (자동 id) */
    add: function (tok, coll, obj) { return req(DB + '/' + coll, { method: 'POST', headers: hdr(tok), body: JSON.stringify({ fields: fields(obj) }) }).then(docOut); },
    /* 조건 검색: where = [필드, 값] (같음) */
    query: function (tok, coll, where) {
      var q = { structuredQuery: { from: [{ collectionId: coll }], limit: 500 } };
      if (where) q.structuredQuery.where = { fieldFilter: { field: { fieldPath: where[0] }, op: 'EQUAL', value: enc(where[1]) } };
      return req(DB + ':runQuery', { method: 'POST', headers: hdr(tok), body: JSON.stringify(q) })
        .then(function (rows) { return (rows || []).filter(function (r) { return r.document; }).map(function (r) { return docOut(r.document); }); });
    },
    /* 목록 (공개 읽기용, 로그인 없이 가능) */
    list: function (tok, coll) {
      var out = [];
      var page = function (t) {
        return req(DB + '/' + coll + '?pageSize=300' + (t ? '&pageToken=' + encodeURIComponent(t) : ''), { headers: hdr(tok) }).then(function (r) {
          (r.documents || []).forEach(function (d) { out.push(docOut(d)); });
          return r.nextPageToken ? page(r.nextPageToken) : out;
        });
      };
      return page('');
    },
    /* 여러 쓰기를 한 번에 (모두 성공하거나 모두 실패) */
    commit: function (tok, writes) {
      var w = writes.map(function (x) {
        var name = 'projects/' + CFG.projectId + '/databases/(default)/documents/' + x.path;
        if (x.del) return { delete: name };
        var o = { update: { name: name, fields: fields(x.data) } };
        if (x.mask) o.updateMask = { fieldPaths: Object.keys(x.data) };
        return o;
      });
      return req(DB + ':commit', { method: 'POST', headers: hdr(tok), body: JSON.stringify({ writes: w }) });
    }
  };
  root.RSSFB = FB;
})(window);
