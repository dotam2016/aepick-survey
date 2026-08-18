# AEPICK BEAUTY DNA

팝업스토어용 단일 기기 인터랙티브 체험 — Six Picks. One Beauty Identity.

문서: [서비스 기획서](docs/01_서비스기획서.md) · [기능정의서](docs/02_기능정의서.md) · [API·데이터 명세](docs/03_API_데이터명세.md)

## 구성

| 경로 | 내용 |
|---|---|
| `apps/kiosk` | 키오스크 체험 앱 (React + Vite, 17화면·6게임) |
| `server` | Backend API + 이미지 합성 + 결과 웹(`/r/:token`) + 대시보드(`/admin`) |
| `packages/shared` | 타입·스코어링·페르소나·i18n(vi/en/ko) 공유 로직 |
| `android-shell` | (2차) Kotlin WebView 키오스크 쉘 |

## 실행

```bash
npm install
npm run dev:server   # http://localhost:8787 (API·결과웹·대시보드)
npm run dev:kiosk    # http://localhost:5173 (키오스크, /api는 8787로 프록시)
```

- 대시보드: http://localhost:8787/admin (기본 키: `aepick-admin`, `ADMIN_KEY` 환경변수로 변경)
- 테스트: `npm test` (스코어링·페르소나 단위테스트)
- 키오스크 자동테스트 시 무입력 타임아웃 비활성화: `http://localhost:5173/?noTimeout=1`

## 환경변수 (server)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8787 | API 포트 |
| `ADMIN_KEY` | aepick-admin | 대시보드 인증 키 |
| `RESULT_TTL_HOURS` | 48 | 결과 이미지 보관 시간 |
| `PUBLIC_BASE_URL` | (요청 호스트) | QR에 들어갈 결과 페이지 베이스 URL — 현장에서는 휴대폰이 접근 가능한 주소로 설정 |
| `AI_PROVIDER` | template | `template`=합성 엔진(Phase A). 외부 생성 API 연동 시 어댑터 추가(Phase B) |

## 개인정보 처리 (구현 반영)

- 원본 사진: 이미지 생성 완료 즉시 파일 삭제
- 결과 이미지: 48시간 후 자동 삭제(10분 주기 스케줄러) + 결과 페이지에서 즉시 삭제 가능
- 결과 URL: 192bit 랜덤 토큰
- 얼굴 인식(개인 식별) 미사용 — 위치·품질 확인만

## Node 요구사항

Node 22.13+ (내장 `node:sqlite` 사용 — 네이티브 빌드 의존성 없음)
