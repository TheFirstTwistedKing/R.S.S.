/* 인물 문서 작성 항목 (Leviathan Registry 작성 · Operation : L 검토 · R.S.S. 아카이브 표시가 모두 이 정의를 씀)
   type: text(기본) · long(여러 줄) · nation(출신 국가) · clr(보안 등급) · status(상태) · portrait · stats · timeline · rels · sign
   req: 필수 */
(function (root) {
  'use strict';
  // 출신 국가: R.S.S. 경제 창의 시대별 나라 목록과 같음 (화폐가 없어진 나라도 출신으로는 고를 수 있음)
  var NATIONS = [
    { era: '리바이어던', list: ['리바이어던'] },
    { era: '구세기', list: ['백월(白月) · 멸망', '루나시아', '솔라리아', '루벨리아 · 멸망', '인페르누스 공화국', '비아레카트리아 · 아스트랄리스로 변경', '레스렉시온'] },
    { era: '구 리바이어던', list: ['버믹쿠루시아', '은월(銀月)', '아스트랄리스', '엘라렌', '코르닉시아', '추풍(秋楓)', '스텔마레', '스텔루비아'] },
    { era: '신 리바이어던', list: ['글라시카에룰리아', '겔루에테르누시아'] }
  ];
  var CLR = ['공개', '대외비', '기밀', '극비'];
  var STATUS = ['활동', '잠적', '구금', '사망', '불명'];
  var STATS = ['근력', '민첩', '지능', '통솔', '사격', '첩보'];
  var SECTIONS = [
    { id: 'basic', no: '01', t: '기본 정보', f: [
      { k: 'name', t: '이름 (본명)', req: 1, ph: '예) 한서윤' },
      { k: 'code', t: '코드네임 · 이명', ph: '예) KESTREL' },
      { k: 'gender', t: '성별', half: 1 }, { k: 'age', t: '나이', half: 1 },
      { k: 'birth', t: '생년월일', half: 1 }, { k: 'race', t: '종족', half: 1 },
      { k: 'home', t: '현재 거주지' }] },
    { id: 'origin', no: '02', t: '출신', f: [
      { k: 'nation', t: '출신 국가', type: 'nation', req: 1 },
      { k: 'region', t: '출신 지역 · 도시' }] },
    { id: 'org', no: '03', t: '소속 · 계급', f: [
      { k: 'org', t: '소속 기관', req: 1, ph: '예) R.S.S. 정보국' },
      { k: 'dept', t: '부서 · 부대' },
      { k: 'rank', t: '계급', req: 1, half: 1 }, { k: 'role', t: '직책', half: 1 },
      { k: 'clr', t: '보안 등급', type: 'clr', half: 1 }, { k: 'joined', t: '소속 날짜', half: 1 },
      { k: 'status', t: '상태', type: 'status', req: 1 }] },
    { id: 'look', no: '04', t: '외형', f: [
      { k: 'portrait', t: '초상', type: 'portrait' },
      { k: 'height', t: '키', half: 1 }, { k: 'weight', t: '체중', half: 1 },
      { k: 'build', t: '체형', half: 1 }, { k: 'hair', t: '머리', half: 1 },
      { k: 'eyes', t: '눈', half: 1 }, { k: 'skin', t: '피부', half: 1 },
      { k: 'marks', t: '특징 (흉터 · 문신 등)', type: 'long' },
      { k: 'outfit', t: '평소 복장', type: 'long' }] },
    { id: 'mind', no: '05', t: '성격', f: [
      { k: 'keywords', t: '성격 키워드', ph: '예) 냉정함 · 집요함 · 의리' },
      { k: 'merits', t: '장점', type: 'long' }, { k: 'flaws', t: '단점', type: 'long' },
      { k: 'likes', t: '좋아하는 것', half: 1 }, { k: 'dislikes', t: '싫어하는 것', half: 1 },
      { k: 'habit', t: '말버릇 · 습관' },
      { k: 'belief', t: '신념 · 가치관', type: 'long' },
      { k: 'fear', t: '두려워하는 것' }] },
    { id: 'skill', no: '06', t: '능력', f: [
      { k: 'field', t: '전문 분야' },
      { k: 'skills', t: '특기 · 기술', type: 'long' },
      { k: 'gear', t: '사용 장비 · 무기', type: 'long' },
      { k: 'stats', t: '능력치 (1 ~ 10)', type: 'stats' }] },
    { id: 'story', no: '07', t: '배경', f: [
      { k: 'upbringing', t: '출생과 성장', type: 'long' },
      { k: 'career', t: '주요 경력', type: 'timeline' },
      { k: 'goal', t: '현재 목표 · 임무', type: 'long' },
      { k: 'secret', t: '비밀 (아카이브에서 검게 가려짐)', type: 'long' }] },
    { id: 'rel', no: '08', t: '관계', f: [{ k: 'rels', t: '다른 인물과의 관계', type: 'rels' }] },
    { id: 'etc', no: '09', t: '기타', f: [
      { k: 'quote', t: '대표 대사', type: 'long' },
      { k: 'symbol', t: '상징 · 테마' },
      { k: 'memo', t: '작성자 메모 (검토자에게)', type: 'long' },
      { k: 'sign', t: '서명', type: 'sign', req: 1 }] }
  ];
  function all() { var o = []; SECTIONS.forEach(function (s) { s.f.forEach(function (f) { o.push(f); }); }); return o; }

  /* 승인된 문서 → R.S.S. 아카이브 인물 문서 (R.S.S. 의 lore 형식) */
  function toEntity(doc, no) {
    var d = {}; try { d = JSON.parse(doc.payload || '{}'); } catch (e) {}
    var fields = [], body = [];
    var add = function (k, v) { if (v != null && String(v).trim()) fields.push({ k: k, v: String(v).trim() }); };
    add('출신', [d.nation, d.region].filter(Boolean).join(' · '));
    add('소속', [d.org, d.dept].filter(Boolean).join(' · '));
    add('계급', d.rank); add('직책', d.role); add('소속 날짜', d.joined);
    add('성별', d.gender); add('나이', d.age); add('생년월일', d.birth); add('종족', d.race); add('거주지', d.home);
    add('키', d.height); add('체중', d.weight); add('체형', d.build); add('머리', d.hair); add('눈', d.eyes); add('피부', d.skin);
    add('성격', d.keywords); add('좋아하는 것', d.likes); add('싫어하는 것', d.dislikes); add('말버릇', d.habit); add('두려워하는 것', d.fear);
    add('전문 분야', d.field); add('상징', d.symbol);
    if (d.stats) add('능력치', STATS.map(function (s, i) { return s + ' ' + (d.stats[i] || 0); }).join(' · '));
    var sec = function (title, v) { if (v && String(v).trim()) body.push('[' + title + ']\n' + String(v).trim()); };
    sec('특징', d.marks); sec('복장', d.outfit); sec('장점', d.merits); sec('단점', d.flaws); sec('신념', d.belief);
    sec('특기', d.skills); sec('장비', d.gear); sec('출생과 성장', d.upbringing);
    if (d.career && d.career.length) body.push('[주요 경력]\n' + d.career.filter(function (r) { return r[0] || r[1]; }).map(function (r) { return (r[0] || '') + '  ' + (r[1] || ''); }).join('\n'));
    sec('현재 목표', d.goal);
    if (d.secret && String(d.secret).trim()) body.push('[비밀]\n||' + String(d.secret).trim() + '||');
    if (d.rels && d.rels.length) body.push('[관계]\n' + d.rels.filter(function (r) { return r[0]; }).map(function (r) { return r[0] + ' — ' + (r[1] || '') + (r[2] ? ' (' + r[2] + ')' : ''); }).join('\n'));
    sec('대표 대사', d.quote ? '“' + d.quote + '”' : '');
    return {
      id: 'reg-' + doc.id, type: 'character', no: no, name: d.name || '이름 없음', alias: d.code || '',
      clearance: Math.max(0, CLR.indexOf(d.clr)), status: d.status || '',
      summary: [d.org, d.rank, d.nation].filter(Boolean).join(' · '),
      fields: fields, body: body.join('\n\n'),
      tags: [d.org, d.nation, '등록 문서'].filter(Boolean),
      image: doc.portrait && doc.portrait.indexOf('data:image/') === 0 ? doc.portrait : '',
      created: doc.approvedAt || doc.createdAt || Date.now(), updated: doc.approvedAt || Date.now()
    };
  }
  root.RSSSchema = { NATIONS: NATIONS, CLR: CLR, STATUS: STATUS, STATS: STATS, SECTIONS: SECTIONS, all: all, toEntity: toEntity };
})(window);
