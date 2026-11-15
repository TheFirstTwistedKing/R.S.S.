# R.S.S.

정보국 컨셉의 기밀 기록 관리 데스크톱 앱 (Windows `.exe`).

## 다운로드

[Releases](../../releases/latest) 에서 받습니다.

| 파일 | 설명 |
|---|---|
| `RSS-Setup-x.y.z.exe` | 설치형. 바탕화면·시작 메뉴에 R.S.S. 아이콘 생성 |
| `RSS-Portable-x.y.z.exe` | 설치 없이 더블클릭으로 실행 |

코드 서명 인증서가 없어서 처음 실행할 때 SmartScreen 경고가 나올 수 있습니다 → **추가 정보 → 실행**.

## 화면

- **잠금 인트로**: 실행할 때마다 홀로그램 문장(방패·날개), 회전하는 지구본, 숫자 자판이 나오고 접속 코드를 입력해야 열립니다. 첫 실행 때 4~8자리 코드를 정합니다.
- **메인**: 터미널 창 + 시스템 로그 창. 모든 작업은 터미널 명령으로 합니다 (`help` 로 목록 확인).

## 터미널 명령

| 분류 | 명령 |
|---|---|
| 조회 | `ls [유형]` · `find <키워드>` · `cat <대상>` · `links <대상>` · `events [대상]` · `stat` |
| 기록 | `new [유형]` · `edit <대상>` · `rm <대상>` · `link <A> <B> [관계]` · `unlink <A> <B>` · `sample` |
| 모듈 창 | `files` · `graph [대상]` · `timeline` · `security` |
| 보안 | `passwd` · `export [--plain]` · `import` · `lock` (Ctrl+L) |
| 시스템 | `help` · `clear` · `log clear` · `history` · `whoami` · `date` |

유형: `chr`(인물) `org`(조직) `loc`(장소) `itm`(물품) `lor`(세계관). 대상은 코드(`CHR-0001`, `chr-1`)·이름·별칭으로 지정합니다. 한글 명령(`목록`, `열람`, `관계도` 등)도 됩니다.

모든 기록과 로그는 접속 코드로 AES-256-GCM 암호화되어 `%APPDATA%\R.S.S.\rss-vault.json` 에만 저장됩니다. 코드를 잊으면 복구할 수 없습니다.

## 개발

```bash
npm install
npm start          # 앱 실행
npm run dist       # Windows exe 빌드 (Windows에서 실행)
```

어느 브랜치든 push 하면 GitHub Actions가 Windows에서 exe를 빌드해 `package.json` 버전으로 Release(`v2.0.0` 등)에 올립니다.

아이콘은 `src/js/emblem.js` 벡터 문장으로 만들어집니다. 문장을 바꿨다면 `node scripts/make-icon.js` (playwright, png-to-ico 필요)로 `build/icon.ico`를 다시 생성합니다.

글꼴: Pretendard · D2Coding · Galmuri(접속 코드 숫자 전용) — 모두 SIL Open Font License 1.1 (`src/fonts/FONTS.md`)
