/* Control · Apex 대사 모음 (한국어 ko / 영어 en)
   대사만 바꾸고 싶으면 이 파일만 수정하면 됨. 배열이면 그중 하나를 무작위로 사용.
   {이름} 같은 자리는 코드에서 채움 (영어 대사도 같은 자리 이름을 씀).
   - CONTROL: 대화 담당. 사용자에게는 존댓말, Apex 에게는 짧은 지시문.
   - APEX: 정보 관리 담당. 보고서 말투. Control 에게만 보고함. */
(function () {
  'use strict';
  var ko = {
    boot: {
      control: ['연결 확인. Control 입니다. 무엇을 도와드릴까요?', 'Control 온라인. 사용자님, 지시를 기다리겠습니다.'],
      apex: ['Apex 대기. 아카이브 색인 {n}건 · 봉인 {s}건 적재 완료.'],
      empty: '아직 공개된 세계관 문서가 없습니다.',
      hint: '명령어가 궁금하시면 "도움말" 을 입력해 주십시오.'
    },
    sealed: {
      toApex: ['Apex, {이름} 문서 호출.', 'Apex, {코드} 문서를 가져와.'],
      ack: '요청 문서 {코드} 확인. 작성 미완료 상태. 열람 승인 미획득. 출력 불가.',
      toUser: ['죄송합니다. {이름} 문서는 아직 완성되지 않았고, 열람 승인도 나지 않았습니다.', '{이름} 문서는 열 수 없습니다. 작성이 끝나지 않았고 승인을 받지 못한 상태입니다.']
    },
    view: {
      toApex: ['Apex, {코드} 파일 열람.', 'Apex, {대상} 기록을 가져와.'],
      ack: '파일 {코드} 호출.',
      toUser: '{코드} {이름} 파일입니다.',
      listToApex: 'Apex, 아카이브 목록 출력.',
      listAck: '목록 {n}건 출력. 봉인 {s}건 포함.',
      listUser: '현재 아카이브 목록입니다. 코드를 누르면 바로 열람합니다.',
      noType: '해당 유형의 문서가 없습니다.',
      searchAsk: '무엇을 찾을까요?',
      searchToApex: 'Apex, "{q}" 검색.',
      searchHits: '일치 항목 {n}건.',
      searchNone: '"{q}" 에 해당하는 기록이 없습니다.',
      searchUser: '"{q}" 검색 결과입니다.'
    },
    event: {
      listToApex: 'Apex, 사건 연대기 출력.',
      listAck: '사건 {n}건.',
      listUser: '기록된 사건을 시간순으로 정리했습니다.',
      none: '아카이브에 기록된 사건이 없습니다.'
    },
    module: {
      graph: '관계도를 띄우겠습니다.', timeline: '타임라인을 엽니다.', security: '보안 · 백업 설정을 엽니다.',
      files: '문서 아카이브를 엽니다.', msg: '메신저 채널을 엽니다.'
    },
    stat: { toApex: 'Apex, 아카이브 현황 보고.', ack: '현황 집계 완료.', toUser: '아카이브 현황입니다.' },
    lock: '보관소를 잠급니다. 다시 뵙겠습니다.',
    backup: { out: '암호화 백업 파일을 저장합니다. 저장 위치를 골라 주십시오.', in: '백업 파일을 불러옵니다.', code: '접속 코드 변경 창을 엽니다.' },
    lang: { set: '언어를 한국어로 바꿨습니다.', apex: '출력 언어: 한국어.' },
    // 작성 · 수정 · 삭제 · 관계 연결 · 사건 기록 요청 → 열람 전용 안내
    ro: {
      toApex: ['Apex, 아카이브 변경 요청 확인.', 'Apex, 쓰기 권한 조회.'],
      apex: ['쓰기 권한 없음. 아카이브는 열람 전용으로 봉인됨.', '거부. 이 단말에는 기록 변경 권한이 부여되지 않음.'],
      user: ['이 아카이브는 열람 전용입니다. 문서를 만들거나 고칠 수 없습니다.', '죄송합니다. 이 단말에서는 기록을 바꿀 권한이 없습니다. 열람만 가능합니다.']
    },
    smalltalk: {
      hello: ['안녕하십니까, 사용자님.', '네, 듣고 있습니다.'],
      thanks: ['별말씀을요.', '언제든 말씀하십시오.'],
      who: 'Control 입니다. 사용자님과 대화하고, 기록 정리는 Apex 에게 지시합니다.',
      apex: 'Apex 는 정보 관리 전용 AI 입니다. 문서 템플릿, 색인, 관계 정리를 맡고 있으며 제 지시를 받습니다.',
      apexSelf: 'Apex. 정보 관리 담당. Control 의 지시에 따름.',
      help: '사용할 수 있는 명령어입니다. 그 밖의 일은 평소 말투로 요청하셔도 됩니다.'
    },
    help: [
      { t: '[명령어]', c: 'hi' },
      { t: '도움말 · help        명령어 목록' },
      { t: '아카이브 · archive    문서 아카이브 창 열기' },
      { t: 'msg                  메신저 창 열기' },
      { t: 'Eng / 한글           표시 언어 바꾸기' },
      { t: '잠금 · lock          보관소 잠그기' },
      { t: '관계도 · 타임라인 · 보안   각 창 열기 (열람)' },
      { t: ' ' },
      { t: '[말로 요청할 수 있는 일]', c: 'hi' },
      { t: '조회        문서 열람 · 목록 · 검색 · 사건 목록 · 현황' },
      { t: '보안        백업 · 백업 불러오기 · 접속 코드 변경' },
      { t: '아카이브는 열람 전용입니다. 문서를 만들거나 고칠 수 없습니다.', c: 'dim' }
    ],
    fallback: ['정확히 이해하지 못했습니다. 다르게 말씀해 주시겠습니까?', '그 요청은 처리 방법을 모르겠습니다.'],
    error: '처리 중 오류가 발생했습니다: {q}',
    cancelled: '취소했습니다.'
  };

  var en = {
    boot: {
      control: ['Link established. This is Control. How can I help?', 'Control online. Standing by for your instructions.'],
      apex: ['Apex ready. Archive index {n} · sealed {s} loaded.'],
      empty: 'No world documents have been released yet.',
      hint: 'Type "help" to see the available commands.'
    },
    sealed: {
      toApex: ['Apex, retrieve {이름}.', 'Apex, pull document {코드}.'],
      ack: 'Document {코드} located. Draft incomplete. Access not authorized. Output refused.',
      toUser: ['I am sorry. The {이름} document is not finished and has not been cleared for access.', '{이름} cannot be opened. It is still a draft and has no access approval.']
    },
    view: {
      toApex: ['Apex, open {코드}.', 'Apex, fetch the {대상} record.'],
      ack: 'Retrieving {코드}.',
      toUser: 'Here is {코드} {이름}.',
      listToApex: 'Apex, print the archive index.',
      listAck: '{n} entries listed, {s} sealed.',
      listUser: 'Current archive index. Click a code to open it.',
      noType: 'No documents of that type.',
      searchAsk: 'What should I look for?',
      searchToApex: 'Apex, search "{q}".',
      searchHits: '{n} matches.',
      searchNone: 'Nothing matches "{q}".',
      searchUser: 'Results for "{q}".'
    },
    event: {
      listToApex: 'Apex, print the chronicle.',
      listAck: '{n} events.',
      listUser: 'Recorded events in chronological order.',
      none: 'No events are recorded in the archive.'
    },
    module: {
      graph: 'Opening the relation graph.', timeline: 'Opening the timeline.', security: 'Opening security and backup.',
      files: 'Opening the document archive.', msg: 'Opening the messenger channel.'
    },
    stat: { toApex: 'Apex, report archive status.', ack: 'Status compiled.', toUser: 'Archive status.' },
    lock: 'Sealing the vault. See you soon.',
    backup: { out: 'Saving an encrypted backup. Choose a location.', in: 'Loading a backup file.', code: 'Opening the access code dialog.' },
    lang: { set: 'Language switched to English.', apex: 'Output language: English.' },
    ro: {
      toApex: ['Apex, archive change requested.', 'Apex, check write permission.'],
      apex: ['No write permission. The archive is sealed read-only.', 'Denied. This terminal holds no record-change rights.'],
      user: ['This archive is read-only. Documents cannot be created or changed.', 'Sorry. This terminal has no permission to change records. Viewing only.']
    },
    smalltalk: {
      hello: ['Hello.', 'I am listening.'],
      thanks: ['You are welcome.', 'Any time.'],
      who: 'This is Control. I talk with you and assign the record work to Apex.',
      apex: 'Apex is an information management AI. It handles templates, indexing and links, under my direction.',
      apexSelf: 'Apex. Information management. Operating under Control.',
      help: 'Available commands. For anything else, just ask in plain words.'
    },
    help: [
      { t: '[COMMANDS]', c: 'hi' },
      { t: 'help · 도움말        list commands' },
      { t: 'archive · 아카이브    open the document archive' },
      { t: 'msg                  open the messenger' },
      { t: 'Eng / 한글           switch language' },
      { t: 'lock · 잠금          seal the vault' },
      { t: 'graph · timeline · security   open those windows' },
      { t: ' ' },
      { t: '[ASK IN PLAIN WORDS]', c: 'hi' },
      { t: 'look up   open · list · search · events · status' },
      { t: 'security  backup · restore · change access code' },
      { t: 'The archive is read-only. Documents cannot be created or changed.', c: 'dim' }
    ],
    fallback: ['I did not catch that. Could you say it another way?', 'I do not know how to handle that request.'],
    error: 'An error occurred: {q}',
    cancelled: 'Cancelled.'
  };

  window.RSSLinesAll = { ko: ko, en: en };
  Object.defineProperty(window, 'RSSLines', { get: function () { return window.RSSLinesAll[(window.RSS && window.RSS.lang) || 'ko']; } });
})();
