# AEPICK BEAUTY DNA — API·데이터 명세서

> ⚠️ **이 문서는 v1(사진 촬영 + AI 이미지 생성) 기준입니다.**
> v2는 사진·AI를 제외하고 app 계정 페어링과 제품 투표를 도입했습니다.
> 현재 구현 기준 문서는 [BE 인계문서](07_BE_인계문서.md)와 [디자이너 가이드](06_디자이너_가이드.md)입니다.
> 이 문서는 채점 로직·페르소나 정의 등 **v2에서도 유효한 부분**을 참고하는 용도로 남겨 둡니다.

> 버전 1.0 · 2026-08-04 · 상태: 검토 대기
> 기능정의서(02)와 세트. 백엔드 API · 데이터 모델 · 이벤트 · i18n 키 구조 정의

---

## 1. API 명세

Base: `/api` · 인증: 프로토타입은 기기 헤더 `X-Device-Id` (관리자는 `X-Admin-Key`)
응답 포맷: `{ ok: true, data: … }` / `{ ok: false, error: { code, message } }`

### 1.1 키오스크용

| # | Method · Path | 요청 | 응답 | 비고 |
|---|---|---|---|---|
| 1 | `POST /sessions` | `{ deviceId, language }` | `{ sessionId }` | 세션 생성 |
| 2 | `PATCH /sessions/:id/consent` | `{ consents: { terms, photo, storage, analytics, marketing }, nickname?, ageGroup?, avatarId? }` | `{ ok }` | photo=false면 avatarId 필수 |
| 3 | `POST /sessions/:id/photo` | multipart `photo` (JPEG ≤ 5MB) + `{ mood }` | `{ photoId }` | 원본은 이미지 생성 후 삭제 |
| 4 | `POST /sessions/:id/answers/:coreKey` | 게임별 payload (아래 1.2) | `{ score, subtype }` | coreKey: repick·value·care·trend·localFit·trust |
| 5 | `POST /sessions/:id/complete` | `{}` | `{ scores, persona, keywords, percentile, resultToken, qrUrl }` | 스코어 확정+이미지 잡 생성+토큰 발급 |
| 6 | `GET /sessions/:id/image-status` | — | `{ status: queued\|processing\|completed\|failed_fallback, imageUrl? }` | 폴링 2초. failed_fallback도 imageUrl 포함(템플릿) |
| 7 | `GET /stats/today` | — | `{ totalParticipants, topPersona, coinAverages, trendVotes, reviewVotes }` | Attract·게임 내 집계 표시용 |
| 8 | `POST /events` | `{ events: [{ type, sessionId?, payload, ts }] }` | `{ ok }` | 배치 전송, 오프라인 큐 재전송 허용 |

### 1.2 게임 answer payload

```jsonc
// repick (CORE1)
{ "picked": "B", "stagesViewed": { "A": 4, "B": 4, "C": 2 }, "durationMs": 24000 }
// value (CORE2)
{ "coins": { "effect": 3, "ingredient": 2, "price": 2, "volume": 1, "gift": 1, "brand": 1, "package": 0, "kol": 0 }, "durationMs": 31000 }
// care (CORE3)
{ "picked": ["fullIngredients", "realTest", "caution"], "elapsedMs": 6800 }
// trend (CORE4)
{ "swipes": { "glassSkin": "love", "softMatte": "next", "naturalPeach": "love", "boldColor": "notme", "minimalSkin": "next", "y2k": "notme" } }
// localFit (CORE5)
{ "scenarioId": "rainy-commute", "choices": { "texture": "light", "finish": "matte", "priority": "lasting", "hydration": "fastAbsorb", "size": "portable" } }
// trust (CORE6)
{ "picked": "B", "cluesViewed": ["B-photo", "A-rating"], "durationMs": 18000 }
```

### 1.3 결과 웹용

| # | Method · Path | 응답 | 비고 |
|---|---|---|---|
| 9 | `GET /r/:token` | 결과 웹 HTML | 모바일 페이지 |
| 10 | `GET /results/:token` | `{ persona, keywords, scores, images: { story916, feed45, plain }, products[3], coupon, expiresAt }` | 만료 시 410 |
| 11 | `GET /results/:token/download/:variant` | 이미지 파일 | variant: story·feed·plain·card |
| 12 | `DELETE /results/:token` | `{ ok }` | 즉시 삭제(이미지+결과), 확인 다이얼로그는 프론트 |

### 1.4 관리자용 (`X-Admin-Key`)

| # | Method · Path | 내용 |
|---|---|---|
| 13 | `GET /admin/overview` | 기기 상태, 진행 중 세션, 오늘 참여/완료/이탈, 평균 체험 시간, 이미지 잡 대기·성공률, QR 스캔 수 |
| 14 | `GET /admin/analytics?from&to` | 축별 평균, 페르소나 분포, 시간대별 참여, 트렌드 투표, 코인 분포, 리뷰 선택, 재촬영률 |
| 15 | `GET /admin/sessions?status&page` | 세션 목록(익명 ID 기준) |
| 16 | `POST /admin/devices/:id/heartbeat` | 키오스크 쉘/앱이 30초 주기 전송 `{ battery?, appVersion, state }` |

---

## 2. 데이터 모델

SQLite(프로토) / PostgreSQL(배포) — 스키마 동일, camelCase 컬럼은 ORM 매핑.

```
sessions
  id TEXT PK (uuid v4)
  device_id TEXT · language TEXT(vi|en|ko)
  status TEXT (active|completed|abandoned)
  consents JSON · nickname TEXT? · age_group TEXT? · avatar_id TEXT?
  mood TEXT? (soft|bright|chic)
  scores JSON? {repick,value,care,trend,localFit,trust}
  subtypes JSON?
  persona TEXT?
  started_at / completed_at DATETIME

answers
  id PK · session_id FK · core_key TEXT · payload JSON
  score INT · subtype TEXT · answered_at DATETIME

photos                       -- 사진 메타는 세션과 분리(12.2 원칙)
  id PK · session_id FK · file_path TEXT
  status TEXT (stored|deleted) · deleted_at DATETIME?

image_jobs
  id PK · session_id FK
  status TEXT (queued|processing|completed|failed_fallback)
  generator TEXT (template|genai)
  attempts INT · started_at / finished_at · error TEXT?

results
  token TEXT PK (crypto random 24B base64url)
  session_id FK · persona TEXT · scores JSON
  image_paths JSON {story916, feed45, plain, card}
  product_ids JSON · coupon_code TEXT
  expires_at DATETIME · deleted_at DATETIME? · scan_count INT · download_count INT

events
  id PK · session_id? · device_id · type TEXT · payload JSON · ts DATETIME

products (시드 12종)
  id PK · name JSON{vi,en,ko} · category · image_path
  persona_tags JSON · axis_affinity JSON · shop_url TEXT · reason_key TEXT

devices
  id PK · name · last_heartbeat DATETIME · app_version · state
```

**보존·삭제 정책 구현**
- `photos`: image_job 완료 훅에서 파일 삭제 + status=deleted
- `results`: 스케줄러(10분 주기)가 `expires_at` 경과분 이미지·레코드 삭제
- `DELETE /results/:token`: 즉시 동일 처리
- `events`·`answers`: 사진과 무관한 익명 데이터로 보존(마케팅 집계용)

---

## 3. 분석 이벤트 정의 (KPI 계측)

| type | 시점 | KPI 연결 |
|---|---|---|
| `session.started` / `session.completed` / `session.abandoned` | 세션 라이프사이클 | 완료율 85%, 이탈 추적(마지막 화면 포함) |
| `photo.captured` / `photo.retake` | 촬영 | 재촬영률 ≤15% |
| `core.completed` {coreKey, durationMs} | 게임 완료 | 평균 체험 시간 |
| `image.completed` {generator, durationMs} / `image.fallback` | 이미지 잡 | 생성 성공률 95% |
| `qr.issued` / `result.scanned` | QR 발급·결과웹 첫 진입 | QR 스캔률 60% |
| `result.downloaded` {variant} | 다운로드 | 다운로드율 40% |
| `result.shared` {channel} | 공유 버튼 | 공유율 20~30% |
| `product.clicked` {productId} | 추천 클릭 | 클릭률 20% |
| `coupon.saved` | 쿠폰 저장 | 쿠폰 KPI |
| `consent.marketing` {granted} | 동의 | CRM 동의율 30~45% |

---

## 4. i18n 키 구조

`packages/shared/i18n/{vi,en,ko}.json` — vi 기본, 키 누락 시 en 폴백.

```jsonc
{
  "common":  { "next": "…", "start": "…", "confirm": "…", "retry": "…", "timeoutWarn": "…" },
  "attract": { "headline": "…", "participants": "…", "topDna": "…" },
  "consent": { "title": "…", "terms": "…", "photo": "…", "storage": "…", "analytics": "…", "marketing": "…", "nickname": "…", "avatarSuggest": "…" },
  "camera":  { "title": "…", "guideNoFace": "…", "guideTooSmall": "…", "guideMulti": "…", "moods": { "soft": "…", "bright": "…", "chic": "…" }, "flashMessage": "…" },
  "quality": { "eyesClosed": "…", "tooDark": "…", "angleTooWide": "…" },
  "core1":   { "title": "…", "question": "…", "products": { "A": { "name": "…", "stage1": "…", "stage2": "…", "stage3": "…", "stage4": "…" }, "B": {}, "C": {} }, "complete": { "longterm": "…", "familiar": "…", "explorer": "…", "instant": "…" } },
  "core2":   { "title": "…", "question": "…", "slots": { "effect": "…", "ingredient": "…" /* 8종 */ }, "todayStat": "…" },
  "core3":   { "title": "…", "question": "…", "cards": { "fullIngredients": "…" /* 8종 */ }, "riskNudge": "…" },
  "core4":   { "title": "…", "question": "…", "styles": { "glassSkin": {} /* 6종 */ }, "resultStat": "…" },
  "core5":   { "title": "…", "scenarios": { "rainy-commute": "…" /* 6종 */ }, "attributes": { "texture": { "light": "…", "rich": "…" } /* 5쌍 */ } },
  "core6":   { "title": "…", "reviews": { "A": {}, "B": {}, "C": {} }, "resultStat": "…" },
  "dna":     { "analyzing": "…", "youAre": "…", "personas": { "loyalGlowKeeper": { "name": "Loyal Glow Keeper", "desc": "…", "keywords": ["…","…","…"] } /* 6종 */ }, "percentile": "…" },
  "reveal":  { "blooming": "…", "delayNotice": "…" },
  "qr":      { "scanTitle": "…", "retention": "…", "deleteNotice": "…", "products": "…", "finish": "…" },
  "resultWeb": { "download": "…", "story": "…", "feed": "…", "share": "…", "coupon": "…", "deleteNow": "…", "expired": "…" },
  "end":     { "thanks": "…" }
}
```

---

## 5. AI 이미지 생성 인터페이스 (어댑터)

```ts
interface ImageGenerator {
  generate(input: {
    photoPath: string | null;       // null = 아바타 모드
    avatarId?: string;
    persona: Persona;               // 컬러·무드·모티프 포함
    mood: "soft" | "bright" | "chic";
    topAxes: [Axis, Axis];
  }): Promise<{ basePath: string }>;  // 합성 전 베이스 이미지
}
// 구현체: TemplateGenerator(Phase A, 항상 성공) · GenAiGenerator(Phase B, 실패 시 Template로 폴백)
// 공통 후처리: composeBranding(basePath, session) → story916/feed45/plain/card 4종 산출
```

잡 처리 흐름: `complete` 호출 → job queued → worker가 generator 실행(타임아웃 20초) → 실패/타임아웃 시 TemplateGenerator 재실행 → 브랜딩 합성 → results에 경로 기록 → 원본 사진 삭제.
