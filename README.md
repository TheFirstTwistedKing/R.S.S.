# R.S.S.

정보국 컨셉의 기밀 기록 관리 데스크톱 앱 (Windows `.exe`).

## 다운로드

항상 최신 버전으로 연결되는 링크입니다. (저장소 이름 끝의 점 `.` 까지 주소에 포함되어야 열립니다)

- 설치형: https://github.com/TheFirstTwistedKing/R.S.S./releases/latest/download/RSS-Setup.exe
- 포터블: https://github.com/TheFirstTwistedKing/R.S.S./releases/latest/download/RSS-Portable.exe
- 릴리즈 페이지: https://github.com/TheFirstTwistedKing/R.S.S./releases/latest

| 파일 | 설명 |
|---|---|
| `RSS-Setup.exe` | 설치형. 바탕화면·시작 메뉴에 R.S.S. 아이콘 생성 |
| `RSS-Portable.exe` | 설치 없이 더블클릭으로 실행 |

코드 서명 인증서가 없어서 처음 실행할 때 SmartScreen 경고가 나올 수 있습니다 → **추가 정보 → 실행**.

## 화면

- **잠금 인트로**: 실행할 때마다 홀로그램 문장(방패·날개), 회전하는 지구본, 숫자 자판이 나오고 접속 코드를 입력해야 열립니다. 첫 실행 때 4~8자리 코드를 정합니다.
- **메인**: 터미널 모양의 대화창 + 시스템 로그 창. 명령어 없이 말로 요청합니다.
- **문서 아카이브**: 상단 R.S.S. 이름 옆 버튼으로 엽니다. 인물 · 조직 · 장소 · 물품 · 세계관 문서를 보고 작성합니다.
- **봉인 문서**: `I Archi(이아키) 행성` 은 미완성 · 승인 대기 문서입니다. 아카이브에서 열면 접근 불가, Control 에게 물어도 승인이 없어 열람할 수 없습니다.
- **소리**: 타자음(실제로 쓰거나 지울 때만), 마우스 클릭음. 메인 화면 SOUND 버튼으로 끄고 켭니다.

## Control · Apex

| AI | 역할 |
|---|---|
| **Control** | 사용자와 대화하는 AI. 요청을 받아 Apex 에게 일을 시킵니다. |
| **Apex** | 정보 관리 전용 AI. 문서 템플릿을 채우고, 빠진 항목은 Control 에게 요청합니다. |

문서 작성 흐름: 사용자 → Control("Apex 에게 맡기겠습니다") → Apex(템플릿 전개, 누락 항목 보고) → Control(사용자에게 하나씩 질문) → Apex(문서 등록)

말하는 예:

- "인물 문서 만들어줘" · "세계관 문서 만들어줘" · "이름은 ○○이고 별칭은 ○○인 극비 인물 만들어줘" · "사건 기록해줘"
- 작성 중: "없음"(건너뛰기) · "여기까지"(마무리) · "취소"
- "○○ 보여줘" · "목록 보여줘" · "세계관 목록" · "○○ 검색해줘" · "사건 목록" · "현황 알려줘"
- "○○ 상태를 사망으로 바꿔줘" · "○○과 ○○을 소속으로 연결해줘" · "○○ 삭제해줘"
- "아카이브 열어줘" · "관계도 열어줘" · "타임라인" · "보안 설정" · "백업해줘" · "코드 바꿔줘" · "잠가줘"

Control·Apex 는 인터넷이나 외부 AI 를 쓰지 않는 앱 안의 규칙 기반 대화입니다. 대사는 `src/js/dialogue.js` 한 파일에 모여 있어 그 파일만 고치면 바뀝니다.

모든 기록과 로그는 접속 코드로 AES-256-GCM 암호화되어 `%APPDATA%\R.S.S.\rss-vault.json` 에만 저장됩니다. 코드를 잊으면 복구할 수 없습니다.

## 개발

```bash
npm install
npm start          # 앱 실행
npm run dist       # Windows exe 빌드 (Windows에서 실행)
```

`main` 으로 가는 PR 은 Windows 빌드만 확인하고, `main` 에 병합되면 GitHub Actions가 exe를 빌드해 `package.json` 버전으로 Release(`v3.1.0` 등)에 올립니다. 새 릴리즈를 만들려면 `version` 을 올려서 병합하세요.

아이콘은 `src/js/emblem.js` 벡터 문장으로 만들어집니다. 문장을 바꿨다면 `node scripts/make-icon.js` (playwright, png-to-ico 필요)로 `build/icon.ico`를 다시 생성합니다.

글꼴: Pretendard · D2Coding · Galmuri(접속 코드 숫자 전용) — 모두 SIL Open Font License 1.1 (`src/fonts/FONTS.md`)
