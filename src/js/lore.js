/* 내장 세계관 문서 (열람 전용)
   앱 안에서는 문서를 만들거나 고칠 수 없고, 이 파일에 적힌 문서만 아카이브에 나옴.
   새 문서를 넣으려면 아래 형식대로 entities 에 추가 (같은 유형 안에서 no 는 겹치지 않게).

   entities 한 개의 형식
   {
     id: 'chr-raven',            // 고유 이름 (영문 · 숫자 · - 만, 관계 · 사건에서 이 id 로 가리킴)
     type: 'character',          // character 인물 · organization 조직 · location 장소 · item 물품 · lore 세계관
     no: 1,                      // 문서 번호 → 코드 CHR-0001
     name: '이름',
     alias: '별칭 · 코드네임',   // 없으면 ''
     clearance: 2,               // 0 공개 · 1 대외비 · 2 기밀 · 3 극비
     status: '활동',             // 없으면 ''
     summary: '한 줄 요약',
     fields: [{ k: '소속', v: '...' }, { k: '나이', v: '...' }],   // 자유 항목
     body: '본문. 여러 줄은 \n 으로. ||이렇게 감싼 부분||은 검게 가려지고 누르면 보임.',
     tags: ['태그']
   }
   links  : { a: 'chr-raven', b: 'org-xxx', label: '소속' }          // a → b 관계
   events : { date: '연도 · 날짜(자유 형식)', title: '사건명', desc: '개요', major: false, entities: ['chr-raven'] } */
(function () {
  'use strict';
  window.RSSLore = {
    entities: [],
    links: [],
    events: []
  };
})();
