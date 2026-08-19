# AEPICK BEAUTY DNA — API·데이터 명세서

> 버전 2.0 · 2026-08-19 · 상태: 구현 반영 완료
> 기능정의서(02)와 세트. 백엔드 API · 데이터 모델 · 이벤트 · i18n 키 구조 정의
> 인계 관점의 요약과 이관 절차는 [BE 인계문서](07_BE_인계문서.md) 참고.

---

## 0. v1 대비 변경 요약

| 구분 | v1 | v2 |
|---|---|---|
| 세션 생성 | `POST /sessions` (익명) | **페어링 클레임으로만 생성** — 익명 생성 라우트 제거 |
| 동의 | `PATCH /sessions/:id/consent` | 제거 (앱 가입 동의로 대체) |
| 사진 | `POST /sessions/:id/photo` | 제거 |
| 이미지 | `GET /sessions/:id/image-status`, `/download/:variant` | 제거 |
| 신원 | 없음 (익명) | **`visitors` — 앱 계정 해시, 방문 횟수** |
| 카탈로그 | 코드 상수 2벌 | **DB + 어드민 CRUD** |
| 투표 | 없음 | **`votes` — 계정당 1회, 3개 선택** |

---

## 1. API 명세

Base: `/api`
응답 포맷: `{ ok: true, data: … }` / `{ ok: false, error: { code, message } }`
인증: 어드민은 `X-Admin-Key`, 직원 기능은 요청 본문의 `pin`

### 1.1 페어링 — 체험 시작

| # | Method · Path | 요청 | 응답 | 호출자 |
|---|---|---|---|---|
| 1 | `POST /pairings` | `{ deviceId }` | `{ code, url, qrPngUrl, expiresAt, mocked }` | PAD |
| 2 | `GET /pairings/:code` | — | `{ status: pending\|claimed\|expired, expiresAt? }` · claimed면 `{ sessionId, language, visitCount }` | PAD (1.5초 폴링) |
| 3 | `POST /pairings/:code/claim` | `{ credential, language? }` | `{ sessionId, visitCount }` | 폰 / 앱 |
| 4 | `POST /pairings/cancel` | `{ deviceId }` | `{ cancelled }` | PAD (고객 이탈) |

- `code`: 9바이트 난수 base64url = **12자**
- TTL **3분**. 만료분은 60초 주기로 정리
- `mocked: true` = 앱 연동 전 목업 상태

**오류**

| 코드 | 상황 |
|---|---|
| `not_found` (404) | 없는 코드 |
| `expired` (409) | 만료된 코드 |
| `already_claimed` (409) | 이미 사용된 코드 |
| `unauthorized` (401) | 신원 검증 실패 |

**동시성 규칙 (PAD 10대 전제)**

1. 코드는 **기기마다** 발급한다. 고정 QR이면 동시 스캔 시 어느 PAD의 체험자인지 판별할 수 없다.
2. 클레임은 `UPDATE … WHERE status='pending'` 의 **변경 행 수로 승자를 가린다.** 동시 요청 10건 중 1건만 성공한다.
3. 같은 PAD가 재발급하면 이전 코드는 즉시 `expired` 된다.

### 1.2 체험

| # | Method · Path | 요청 | 응답 |
|---|---|---|---|
| 5 | `PATCH /sessions/:id/language` | `{ language }` | `{ language }` |
| 6 | `POST /sessions/:id/answers/:coreKey` | 게임별 payload (1.3) | `{ score, subtype }` |
| 7 | `POST /sessions/:id/complete` | `{}` | `{ scores, persona, percentile, resultToken, qrPngUrl, resultUrl, brands[], products[] }` |
| 8 | `GET /stats/today` | — | `{ totalParticipants, topPersona, topCoinSlot, trendVotes, reviewVotes }` |
| 9 | `POST /events` | `{ events: [{ type, sessionId?, payload, ts }] }` | `{ ok }` |

`coreKey` ∈ `repick · value · care · trend · localFit · trust`

> **세션 생성 라우트는 없다.** v1의 익명 `POST /sessions` 는 QR 없이 체험 기록을 만들어
> 방문 집계와 투표 자격을 우회할 수 있어 제거했다.

### 1.3 게임 answer payload

v1과 동일하다. 채점 로직(`packages/shared/src/scoring.ts`)이 바뀌지 않았다.

```jsonc
// repick (CORE1)
{ "picked": "B", "stagesViewed": { "A": 4, "B": 4, "C": 2 }, "durationMs": 24000 }
// value (CORE2) — 코인 합계가 정확히 일치해야 함. 아니면 400
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

검증 실패 시 `invalid_answer` (400).

### 1.4 결과

| # | Method · Path | 응답 | 비고 |
|---|---|---|---|
| 10 | `GET /r/:token` | HTML | 모바일 결과 페이지 |
| 11 | `GET /results/:token` | `{ persona, language, scores, brands[], products[], coupon, expiresAt }` | 만료·삭제 시 410 |
| 12 | `DELETE /results/:token` | `{ ok }` | 고객 요청 즉시 삭제 |

- 토큰: 24바이트 난수 base64url (192bit)
- `RESULT_TTL_HOURS` 기본 **48시간**, 10분 주기 정리
- **추천 제품은 체험 시점에 확정된 것을 되살린다.** 그 사이 카탈로그가 바뀌어도 발급된 결과는 고정

### 1.5 투표

| # | Method · Path | 요청 | 응답 | 인증 |
|---|---|---|---|---|
| 13 | `GET /vote/:token/options` | — | `{ pickCount, brands[], alreadyVoted, picked[] }` | — |
| 14 | `POST /vote/:token` | `{ productIds: [3개] }` | `{ votedAt }` | — |
| 15 | `GET /vote/:token/status` | — | `{ voted, votedAt?, rewardClaimedAt?, picks[] }` | — |
| 16 | `POST /vote/:token/staff` | `{ pin }` | `{ visitCount, voted, votedAt, rewardClaimedAt }` | **PIN** |
| 17 | `POST /vote/:token/reward` | `{ pin, staff? }` | `{ claimedAt }` | **PIN** |
| 18 | `GET /v/:token` · `/v/:token/done` | — | HTML | — |

**서버 측 검증** (클라이언트를 신뢰하지 않는다)

| 검사 | 오류 코드 |
|---|---|
| 정확히 3개 | `bad_request` |
| 중복 없음 | `bad_request` |
| **카탈로그에 실재하는 제품** | `bad_request` |
| 계정당 1회 | `already_voted` (409) |
| 사은품 중복 지급 | `already_claimed` (409) |

투표는 결과 토큰 → 세션 → `visitor_id` 로 **체험한 본인 계정에 귀속**된다.

### 1.6 카탈로그

| # | Method · Path | 인증 | 내용 |
|---|---|---|---|
| 19 | `GET /catalog` | — | 활성 브랜드·제품 (투표 화면용) |
| 20 | `GET /catalog/admin` | `X-Admin-Key` | 비활성 포함 전체 |
| 21 | `PUT /catalog/admin/brands/:id` | `X-Admin-Key` | 브랜드 생성·수정 |
| 22 | `DELETE /catalog/admin/brands/:id` | `X-Admin-Key` | 삭제 (소속 제품 함께) |
| 23 | `PUT /catalog/admin/products/:id` | `X-Admin-Key` | 제품 생성·수정 |
| 24 | `DELETE /catalog/admin/products/:id` | `X-Admin-Key` | 제품 삭제 |

> 본문 없는 `DELETE` 에 `Content-Type: application/json` 을 붙이면 Fastify가 400으로 막는다.
> 클라이언트는 인증 헤더만 보내야 한다.

### 1.7 관리자

| # | Method · Path | 내용 |
|---|---|---|
| 25 | `GET /admin/overview` | 기기 상태, 오늘 참여·완료·이탈, 평균 체험 시간 |
| 26 | `GET /admin/analytics?from&to` | 축별 평균, 페르소나 분포, 시간대별 참여 |
| 27 | `GET /admin/sessions?status&page` | 세션 목록 |
| 28 | `POST /admin/devices/:id/heartbeat` | `{ battery?, appVersion, state }` |

### 1.8 페이지 (HTML)

| 경로 | 용도 |
|---|---|
| `/` | PAD 키오스크 |
| `/p/:code` | 페어링 착지 (목업 — 실제로는 앱이 대체) |
| `/r/:token` | 모바일 결과 |
| `/v/:token` · `/v/:token/done` | 투표 · 완료 |
| `/admin` · `/admin/catalog` | 운영자 대시보드 · 카탈로그 관리 |

---

## 2. 데이터 모델

`node:sqlite`(현재) / PostgreSQL(운영 이관 권장 — 인계문서 5-1)

```
visitors ──< sessions ──< answers
   │            │
   │            └──< results ──< votes
   │
   └── 방문 횟수

pairings (device_id → session_id)
brands ──< brand_products
devices, events
```

```
visitors                      -- 앱 계정. 원문을 저장하지 않는다
  id TEXT PK                  -- SHA-256(salt + appUserId) 앞 22자
  visit_count INT             -- 첫 방문이 1
  first_seen_at / last_seen_at DATETIME

pairings
  code TEXT PK                -- 9B 난수 base64url (12자)
  device_id TEXT              -- 기기마다 다른 값이어야 함
  status TEXT (pending|claimed|expired)
  visitor_id TEXT? · session_id TEXT?
  created_at / expires_at / claimed_at DATETIME

sessions
  id TEXT PK (uuid v4)
  device_id TEXT · visitor_id TEXT?      -- ★ v2 추가
  language TEXT (vi|en|ko) · status TEXT (active|completed|abandoned)
  scores JSON? · subtypes JSON? · persona TEXT?
  started_at / completed_at DATETIME

answers
  id PK · session_id FK · core_key TEXT · payload JSON
  score INT · subtype TEXT · answered_at DATETIME
  UNIQUE(session_id, core_key)

results
  token TEXT PK               -- 24B 난수 base64url
  session_id FK UNIQUE · persona TEXT · scores JSON
  product_ids JSON            -- 체험 시점 확정 제품
  coupon_code TEXT
  expires_at · deleted_at? DATETIME · scan_count INT · download_count INT

votes
  id PK · visitor_id TEXT UNIQUE          -- ★ 계정당 1회
  session_id? · result_token?
  product_ids JSON            -- 3개
  voted_at DATETIME
  reward_claimed_at? · reward_staff?      -- 사은품 지급 기록

brands
  id TEXT PK · name TEXT
  tagline JSON {ko,en,vi} · emoji TEXT · logo_url TEXT?
  persona_tags JSON · axis_affinity JSON
  sort_order INT · active INT · updated_at

brand_products
  id TEXT PK · brand_id TEXT
  name JSON {ko,en,vi} · price TEXT · shop_url TEXT · image_url TEXT?
  sort_order INT · active INT · updated_at

events
  id PK · session_id? · device_id? · type TEXT · payload JSON · ts DATETIME

devices
  id PK · name · last_heartbeat · app_version · state
```

**제거된 테이블** — `photos`, `image_jobs` (사진·AI 파이프라인과 함께 삭제)

**다국어·배열 필드**는 JSON 문자열로 저장한다. PostgreSQL 이관 시 `jsonb` 권장.

**보존·삭제 정책**

| 대상 | 정책 |
|---|---|
| `results` | 48시간 후 자동 삭제 + 고객 요청 시 즉시 |
| `visitors` | 재방문 집계용으로 보존 (해시만, 원문 없음) |
| `pairings` | 만료분 60초 주기 정리 |
| `events` · `answers` | 익명 데이터로 보존 (마케팅 집계) |

> **얼굴 사진을 다루지 않는다.** v1의 원본 사진 즉시 삭제 정책은 v2에서 불필요해졌다.

---

## 3. 분석 이벤트

| type | 시점 | KPI 연결 |
|---|---|---|
| `pairing.issued` | PAD가 QR 발급 | 노출 대비 스캔률 |
| `pairing.claimed` {visitCount} | 고객이 QR 스캔 | **체험 시작 수 · 재방문율** |
| `pairing.swept` {n} | 만료 코드 정리 | 미전환(찍지 않고 이탈) 추정 |
| `session.completed` / `session.abandoned` | 세션 종료 | 완료율, 이탈 지점 |
| `core.completed` {coreKey, durationMs} | 게임 완료 | 평균 체험 시간 |
| `qr.issued` / `result.scanned` | 결과 QR 발급·첫 진입 | **종료 QR 스캔률** |
| `vote.submitted` {productIds} | 투표 완료 | **투표 전환율 · 제품 선호도** |
| `reward.claimed` | 사은품 지급 | 지급 수 |
| `staff.lookup` | 직원이 재방문 조회 | 운영 감사 추적 |
| `product.clicked` {productId, brandId} | 추천 클릭 | 클릭률 |
| `result.shared` {channel} | 공유 | 공유율 |
| `catalog.brand.saved` / `catalog.brand.deleted` | 카탈로그 변경 | 운영 감사 추적 |

**제거된 이벤트** — `photo.captured`, `photo.retake`, `image.completed`, `image.fallback`, `result.downloaded`, `consent.marketing`

---

## 4. i18n 키 구조

`packages/shared/src/i18n/{vi,en,ko}.json` — vi 기본, 키 누락 시 en 폴백.
**3개 언어 키 트리 일치는 자동 테스트로 강제**한다 (`packages/shared/test/i18n.test.ts`).

```jsonc
{
  "common":  { "next": "…", "start": "…", "confirm": "…", "retry": "…", "timeoutWarn": "…" },
  "attract": { "headline": "…", "sub": "…", "bullets": ["…"],
               "participantsLabel": "…", "topDnaLabel": "…",
               "scanTitle": "…", "scanBody": "…", "scanRetry": "…" },   // ★ v2 추가
  "intro":   { "title": "…", "sub": "…" },
  "core1"…"core6": { /* v1과 동일 */ },
  "dna":     { "analyzing": "…", "analyzingComing": "…", "youAre": "…",
               "personas": { "loyalGlowKeeper": { "name": "…", "desc": "…", "keywords": ["…"] } /* 6종 */ },
               "percentile": "…" },
  "qr":      { "scanTitle": "…", "retention": "…", "deleteNotice": "…", "finish": "…" },
  "resultWeb": { "title": "…", "share": "…", "couponTitle": "…", "brandsTitle": "…",
                 "voteTitle": "…", "voteDesc": "…", "voteCta": "…", "voteDone": "…",  // ★ v2 추가
                 "deleteNow": "…", "expired": "…" },
  "end":     { "thanks": "…" }
}
```

**제거된 블록** — `consent`, `camera`, `quality`, `reveal`

> **투표·완료 페이지와 목업 페어링 페이지의 문구는 i18n을 쓰지 않는다.**
> 서버 HTML에 한국어로 하드코딩되어 있다. 베트남 고객 대상 운영 전에 다국어 처리가 필요하다.
> (`server/src/votePages.ts`, `server/src/pairingRoutes.ts`)

---

## 5. 앱 연동 인터페이스 (어댑터)

v1의 AI 이미지 생성 어댑터 자리를 **앱 신원 확인 어댑터**가 대체한다.

```ts
// server/src/identity.ts
interface IdentityProvider {
  readonly name: string;
  /** 폰이 보낸 자격 증명을 검증해 신원을 돌려준다. 실패 시 null (예외 아님) */
  resolve(credential: string): Promise<AppIdentity | null>;
}
interface AppIdentity {
  appUserId: string;    // 원문. 저장하지 않고 해시만 남긴다
  language?: string;
}
```

현재 구현체는 `mockProvider` — **검증 없이** 받은 문자열을 그대로 계정으로 인정한다.
`identityProvider` 만 실제 구현으로 교체하면 나머지 코드는 손댈 필요가 없다.

```
클레임 흐름:
  폰 → POST /pairings/:code/claim { credential }
     → identityProvider.resolve(credential)
     → visitorIdOf(appUserId)        // SHA-256(salt + id), 원문 저장 안 함
     → visitors upsert (visit_count + 1)
     → sessions insert (visitor_id 연결)
     → pairings 원자적 claimed 전환
```

> ⚠️ **평문 user id를 그대로 받으면 안 된다.** 타인의 id를 넣어 재방문 횟수를 조작하거나
> 남의 투표 자격을 소진시킬 수 있다. 서명 토큰(JWT 등)을 검증해 `sub` 를 쓰는 방식을 권한다.
> 앱 팀과 합의할 항목은 [BE 인계문서 2장](07_BE_인계문서.md) 참고.

---

## 6. 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8787 | |
| `HTTPS` | — | `1`이면 자체 서명 인증서로 기동 |
| `TUNNEL` | — | `1`이면 프록시 뒤 모드 + 관리자 키 임의 생성 |
| `PUBLIC_BASE_URL` | 요청 호스트에서 유추 | QR 주소 베이스 |
| `ADMIN_KEY` | `aepick-admin` | **운영 시 변경 필수** |
| `STAFF_PIN` | `1234` | **운영 시 변경 필수** |
| `VISITOR_HASH_SALT` | `aepick-dev-salt` | **운영 시 변경 필수** (바꾸면 방문 이력 연결 끊김) |
| `RESULT_TTL_HOURS` | 48 | |
