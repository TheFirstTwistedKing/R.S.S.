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
      empty: '아카이브가 비어 있습니다. 문서 작성은 저에게 말씀해 주시면 Apex 와 함께 정리하겠습니다.',
      hint: '명령어가 궁금하시면 "도움말" 을 입력해 주십시오.'
    },
    sealed: {
      toApex: ['Apex, {이름} 문서 호출.', 'Apex, {코드} 문서를 가져와.'],
      ack: '요청 문서 {코드} 확인. 작성 미완료 상태. 열람 승인 미획득. 출력 불가.',
      toUser: ['죄송합니다. {이름} 문서는 아직 완성되지 않았고, 열람 승인도 나지 않았습니다.', '{이름} 문서는 열 수 없습니다. 작성이 끝나지 않았고 승인을 받지 못한 상태입니다.']
    },
    create: {
      toApex: ['Apex, {유형} 문서 신규 작성. 사용자님 요청이다.', 'Apex, {유형} 문서 하나 정리해 줘. 요청자는 사용자님.'],
      ack: ['지시 확인. {유형} 템플릿 생성을 시작합니다.', '수신. {유형} 문서 템플릿 전개.'],
      toUser: ['{유형} 문서 작성은 Apex 에게 맡기겠습니다. 정리 속도가 더 빠릅니다.', '알겠습니다. 문서 정리는 Apex 가 담당하도록 지시했습니다.'],
      missing: 'Control, 템플릿 대조 결과 누락 항목 {n}건: {목록}. 정보 확보 요청.',
      relay: 'Apex 가 정보를 요청했습니다. 필요한 항목은 {목록} 입니다. 하나씩 여쭙겠습니다.',
      askFirst: '{항목}을(를) 알려 주십시오.',
      ask: ['다음은 {항목} 입니다.', '{항목}은(는) 어떻게 됩니까?', 'Apex 가 {항목}도 요청합니다.'],
      askOptionalNote: '(모르시면 "없음", 나머지를 생략하려면 "여기까지")',
      fill: '{항목} 반영.',
      skip: '{항목} 공란 처리.',
      done: '문서 정리 완료. {코드} 아카이브 등록. 보고합니다.',
      report: ['Apex 가 {코드} {이름} 문서를 등록했습니다.', '완료되었습니다. {코드} {이름} 문서가 아카이브에 들어갔습니다.'],
      cancel: '작성을 취소했습니다. Apex 에게도 중단을 지시했습니다.',
      cancelApex: '작업 중단. 임시 템플릿 폐기.',
      stopApex: 'Apex, 작업 중단.',
      askType: '어떤 유형의 문서입니까? 인물 · 조직 · 장소 · 물품 · 세계관 · 사건 중에서 골라 주십시오.',
      prepApex: 'Apex, 신규 문서 작성 준비.',
      apexAskType: 'Control, 문서 유형 미지정. 템플릿 선택 불가.',
      badClearance: '보안 등급은 공개 · 대외비 · 기밀 · 극비 중 하나로 말씀해 주십시오.',
      badRequired: '{항목}은(는) 필수 항목이라 생략할 수 없습니다.',
      eventDone: '사건 기록 완료. 연대기에 등재. 보고합니다.',
      eventReport: '사건 "{이름}" 을(를) 기록했습니다. 타임라인에서도 확인하실 수 있습니다.'
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
    edit: {
      toApex: 'Apex, {코드} 의 {항목} 을(를) "{값}" 으로 갱신.',
      ack: '{코드} {항목}: {이전} → {값}. 갱신 완료.',
      toUser: '{코드} {이름} 의 {항목}을(를) 수정했습니다.',
      need: '어느 항목을 무엇으로 바꿀지 알려 주십시오. 예: "(이름) 상태를 사망으로 바꿔줘"'
    },
    link: {
      toApex: 'Apex, {A} 와 {B} 를 "{관계}" 관계로 연결.',
      ack: '관계 등록: {A} ─[{관계}]→ {B}.',
      toUser: '{A이름} 와(과) {B이름} 을(를) 연결했습니다.',
      need: '연결할 두 문서와 관계를 알려 주십시오.'
    },
    del: {
      need: '삭제할 문서 이름이나 코드를 알려 주십시오.',
      confirm: '{코드} {이름} 문서와 연결된 관계를 삭제합니다. 진행할까요? ("응" / "아니")',
      toApex: 'Apex, {코드} 문서 폐기.',
      ack: '{코드} 폐기 완료. 연결 관계 {n}건 정리.',
      toUser: '삭제했습니다.',
      cancel: '삭제를 취소했습니다.'
    },
    event: {
      toApex: 'Apex, 사건 기록 작성.',
      ack: '지시 확인. 사건 기록 템플릿 전개.',
      listToApex: 'Apex, 사건 연대기 출력.',
      listAck: '사건 {n}건.',
      listUser: '기록된 사건을 시간순으로 정리했습니다.',
      none: '기록된 사건이 없습니다. 사건 기록을 요청하시면 작성합니다.'
    },
    module: {
      graph: '관계도를 띄우겠습니다.', timeline: '타임라인을 엽니다.', security: '보안 · 백업 설정을 엽니다.',
      files: '문서 아카이브를 엽니다.', msg: '메신저 채널을 엽니다.'
    },
    stat: { toApex: 'Apex, 아카이브 현황 보고.', ack: '현황 집계 완료.', toUser: '아카이브 현황입니다.' },
    lock: '보관소를 잠급니다. 다시 뵙겠습니다.',
    backup: { out: '암호화 백업 파일을 저장합니다. 저장 위치를 골라 주십시오.', in: '백업 파일을 불러옵니다.', code: '접속 코드 변경 창을 엽니다.' },
    lang: { set: '언어를 한국어로 바꿨습니다.', apex: '출력 언어: 한국어.' },
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
      { t: '관계도 · 타임라인 · 보안   각 창 열기' },
      { t: ' ' },
      { t: '[말로 요청할 수 있는 일]', c: 'hi' },
      { t: '문서 작성   인물 · 조직 · 장소 · 물품 · 세계관 문서, 사건 기록' },
      { t: '조회        문서 열람 · 목록 · 검색 · 사건 목록 · 현황' },
      { t: '정리        항목 수정 · 관계 연결 · 문서 삭제' },
      { t: '보안        백업 · 백업 불러오기 · 접속 코드 변경' },
      { t: '작성 중     "없음" 건너뛰기 · "여기까지" 마무리 · "취소"', c: 'dim' }
    ],
    fallback: ['정확히 이해하지 못했습니다. 다르게 말씀해 주시겠습니까?', '그 요청은 처리 방법을 모르겠습니다.'],
    error: '처리 중 오류가 발생했습니다: {q}',
    cancelled: '취소했습니다.'
  };

  var en = {
    boot: {
      control: ['Link established. This is Control. How can I help?', 'Control online. Standing by for your instructions.'],
      apex: ['Apex ready. Archive index {n} · sealed {s} loaded.'],
      empty: 'The archive is empty. Tell me when you want a document written and Apex will handle it.',
      hint: 'Type "help" to see the available commands.'
    },
    sealed: {
      toApex: ['Apex, retrieve {이름}.', 'Apex, pull document {코드}.'],
      ack: 'Document {코드} located. Draft incomplete. Access not authorized. Output refused.',
      toUser: ['I am sorry. The {이름} document is not finished and has not been cleared for access.', '{이름} cannot be opened. It is still a draft and has no access approval.']
    },
    create: {
      toApex: ['Apex, new {유형} document. Requested by the user.', 'Apex, put together a {유형} document for the user.'],
      ack: ['Order received. Building {유형} template.', 'Acknowledged. Deploying {유형} template.'],
      toUser: ['I will hand the {유형} document to Apex. It works faster.', 'Understood. Apex is now assembling the document.'],
      missing: 'Control, template check found {n} missing fields: {목록}. Requesting data.',
      relay: 'Apex needs some information: {목록}. I will ask one at a time.',
      askFirst: 'Please tell me the {항목}.',
      ask: ['Next: {항목}.', 'What is the {항목}?', 'Apex also needs the {항목}.'],
      askOptionalNote: '(say "none" to skip, "done" to finish)',
      fill: '{항목} recorded.',
      skip: '{항목} left blank.',
      done: 'Document complete. {코드} filed to archive. Reporting.',
      report: ['Apex has filed {코드} {이름}.', 'Done. {코드} {이름} is now in the archive.'],
      cancel: 'Writing cancelled. I told Apex to stop as well.',
      cancelApex: 'Task aborted. Draft template discarded.',
      stopApex: 'Apex, abort.',
      askType: 'What kind of document? Character · organization · location · item · lore · event.',
      prepApex: 'Apex, prepare a new document.',
      apexAskType: 'Control, document type not specified. Cannot select template.',
      badClearance: 'Clearance must be one of: unclassified · restricted · secret · top secret.',
      badRequired: '{항목} is required and cannot be skipped.',
      eventDone: 'Event logged to the chronicle. Reporting.',
      eventReport: 'Event "{이름}" recorded. You can also see it in the timeline.'
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
    edit: {
      toApex: 'Apex, set {항목} of {코드} to "{값}".',
      ack: '{코드} {항목}: {이전} → {값}. Updated.',
      toUser: 'Updated the {항목} of {코드} {이름}.',
      need: 'Tell me which field to change and to what. e.g. "change (name) status to deceased"'
    },
    link: {
      toApex: 'Apex, link {A} and {B} as "{관계}".',
      ack: 'Link filed: {A} ─[{관계}]→ {B}.',
      toUser: 'Linked {A이름} and {B이름}.',
      need: 'Tell me the two documents and the relation.'
    },
    del: {
      need: 'Tell me the name or code of the document to delete.',
      confirm: 'This deletes {코드} {이름} and its links. Proceed? (yes / no)',
      toApex: 'Apex, destroy {코드}.',
      ack: '{코드} destroyed. {n} links cleared.',
      toUser: 'Deleted.',
      cancel: 'Deletion cancelled.'
    },
    event: {
      toApex: 'Apex, new event record.',
      ack: 'Order received. Deploying event template.',
      listToApex: 'Apex, print the chronicle.',
      listAck: '{n} events.',
      listUser: 'Recorded events in chronological order.',
      none: 'No events recorded yet. Ask me to record one.'
    },
    module: {
      graph: 'Opening the relation graph.', timeline: 'Opening the timeline.', security: 'Opening security and backup.',
      files: 'Opening the document archive.', msg: 'Opening the messenger channel.'
    },
    stat: { toApex: 'Apex, report archive status.', ack: 'Status compiled.', toUser: 'Archive status.' },
    lock: 'Sealing the vault. See you soon.',
    backup: { out: 'Saving an encrypted backup. Choose a location.', in: 'Loading a backup file.', code: 'Opening the access code dialog.' },
    lang: { set: 'Language switched to English.', apex: 'Output language: English.' },
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
      { t: 'write     character · organization · location · item · lore, events' },
      { t: 'look up   open · list · search · events · status' },
      { t: 'organize  change a field · link · delete' },
      { t: 'security  backup · restore · change access code' },
      { t: 'while writing: "none" skip · "done" finish · "cancel"', c: 'dim' }
    ],
    fallback: ['I did not catch that. Could you say it another way?', 'I do not know how to handle that request.'],
    error: 'An error occurred: {q}',
    cancelled: 'Cancelled.'
  };

  window.RSSLinesAll = { ko: ko, en: en };
  Object.defineProperty(window, 'RSSLines', { get: function () { return window.RSSLinesAll[(window.RSS && window.RSS.lang) || 'ko']; } });
})();
