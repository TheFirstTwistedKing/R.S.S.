# R.S.S.

정보국 컨셉의 기밀 기록 관리 데스크톱 앱 (Windows `.exe`).

## 다운로드

[Releases](../../releases/latest) 에서 받습니다.

| 파일 | 설명 |
|---|---|
| `RSS-Setup-x.y.z.exe` | 설치형. 바탕화면·시작 메뉴에 R.S.S. 아이콘 생성 |
| `RSS-Portable-x.y.z.exe` | 설치 없이 더블클릭으로 실행 |

코드 서명 인증서가 없어서 처음 실행할 때 SmartScreen 경고가 나올 수 있습니다 → **추가 정보 → 실행**.

## 기능

- **잠금 인트로**: 실행할 때마다 R.S.S. 문장(방패·날개)과 숫자 자판이 나오고 접속 코드를 입력해야 열립니다. 첫 실행 때 4~8자리 코드를 정합니다.
- **파일**: 인물 · 조직 · 장소 · 물품 · 세계관 기록. 보안 등급, 상태, 태그, 사용자 정의 항목, 초상 이미지, `||가림 문장||` 처리
- **관계도**: 파일끼리 관계를 이어 네트워크로 보기 (끌기, 확대, 선택)
- **타임라인**: 사건을 시간순으로 정리하고 관련 파일과 연결
- **보안·백업**: 모든 기록은 접속 코드로 AES-256-GCM 암호화되어 PC에만 저장. 코드 변경, 자동 잠금, 암호화 백업/일반 JSON 내보내기·가져오기

저장 위치: `%APPDATA%\R.S.S.\rss-vault.json` (암호화된 상태). 접속 코드를 잊으면 복구할 수 없습니다.

## 개발

```bash
npm install
npm start          # 앱 실행
npm run dist       # Windows exe 빌드 (Windows에서 실행)
```

어느 브랜치든 push 하면 GitHub Actions가 Windows에서 exe를 빌드해 `package.json` 버전으로 Release(`v1.0.0` 등)에 올립니다. 새 릴리즈를 만들려면 `package.json`의 `version`을 올리세요.

아이콘은 `src/js/emblem.js` 픽셀 데이터로 만들어집니다. 문장을 바꿨다면 `node scripts/make-icon.js` (playwright, png-to-ico 필요)로 `build/icon.ico`를 다시 생성합니다.

글꼴: [Galmuri](https://github.com/quiple/galmuri) — SIL Open Font License 1.1 (`src/fonts/OFL.md`)
