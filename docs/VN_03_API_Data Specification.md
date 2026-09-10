# AEPICK BEAUTY DNA — Đặc tả API·dữ liệu

> Phiên bản 2.0 · 2026-08-19 · Trạng thái: Đã phản ánh vào triển khai
> Đi kèm tài liệu định nghĩa chức năng (02). Định nghĩa Backend API · data model · event · cấu trúc i18n key
> Xem phần tóm tắt theo góc nhìn bàn giao và quy trình chuyển đổi trong [tài liệu bàn giao BE](VN_07_BE_인계문서.md).

---

## 0. Tóm tắt thay đổi so với v1

| Hạng mục | v1 | v2 |
|---|---|---|
| Tạo session | `POST /sessions` (ẩn danh) | **Chỉ tạo thông qua pairing claim** — đã xóa route tạo ẩn danh |
| Đồng ý | `PATCH /sessions/:id/consent` | Xóa (thay bằng đồng ý khi đăng ký app) |
| Ảnh | `POST /sessions/:id/photo` | Xóa |
| Hình ảnh | `GET /sessions/:id/image-status`, `/download/:variant` | Xóa |
| Danh tính | Không có (ẩn danh) | **`visitors` — hash tài khoản app, số lần ghé** |
| Catalog | 2 bộ code constant | **DB + admin CRUD** |
| Bình chọn | Không có | **`votes` — mỗi tài khoản 1 lần, chọn 3 sản phẩm** |

---

## 1. Đặc tả API

Base: `/api`
Định dạng response: `{ ok: true, data: … }` / `{ ok: false, error: { code, message } }`
Xác thực: admin dùng `X-Admin-Key`, chức năng nhân viên dùng `pin` trong request body

### 1.1 Pairing — bắt đầu trải nghiệm

| # | Method · Path | Request | Response | Caller |
|---|---|---|---|---|
| 1 | `POST /pairings` | `{ deviceId }` | `{ code, url, qrPngUrl, expiresAt, mocked }` | PAD |
| 2 | `GET /pairings/:code` | — | `{ status: pending\|claimed\|expired, expiresAt? }` · nếu claimed thì `{ sessionId, language, visitCount }` | PAD (polling 1.5 giây) |
| 3 | `POST /pairings/:code/claim` | `{ credential, language? }` | `{ sessionId, visitCount }` | điện thoại / app |
| 4 | `POST /pairings/cancel` | `{ deviceId }` | `{ cancelled }` | PAD (khách rời đi) |

- `code`: random 9 byte base64url = **12 ký tự**
- TTL **3 phút**. Dọn dữ liệu hết hạn mỗi 60 giây
- `mocked: true` = trạng thái mock trước khi tích hợp app

**Lỗi**

| Code | Trường hợp |
|---|---|
| `not_found` (404) | Code không tồn tại |
| `expired` (409) | Code đã hết hạn |
| `already_claimed` (409) | Code đã được sử dụng |
| `unauthorized` (401) | Xác minh danh tính thất bại |

**Quy tắc concurrency (giả định 10 PAD)**

1. Code được phát hành **theo từng thiết bị**. Nếu dùng QR cố định thì khi quét đồng thời không thể biết trải nghiệm thuộc PAD nào.
2. Claim phân định request thắng bằng **số dòng bị thay đổi** của `UPDATE … WHERE status='pending'`. Trong 10 request đồng thời chỉ 1 request thành công.
3. Nếu cùng PAD phát hành lại, code trước đó lập tức chuyển sang `expired`.

### 1.2 Trải nghiệm

| # | Method · Path | Request | Response |
|---|---|---|---|
| 5 | `PATCH /sessions/:id/language` | `{ language }` | `{ language }` |
| 6 | `POST /sessions/:id/answers/:coreKey` | payload theo từng game (1.3) | `{ score, subtype }` |
| 7 | `POST /sessions/:id/complete` | `{}` | `{ scores, persona, percentile, resultToken, qrPngUrl, resultUrl, brands[], products[] }` |
| 8 | `GET /stats/today` | — | `{ totalParticipants, topPersona, topCoinSlot, trendVotes, reviewVotes }` |
| 9 | `POST /events` | `{ events: [{ type, sessionId?, payload, ts }] }` | `{ ok }` |

`coreKey` ∈ `repick · value · care · trend · localFit · trust`

> **Không có route tạo session.** Anonymous `POST /sessions` của v1 có thể tạo record trải nghiệm không qua QR,
> từ đó bypass thống kê lượt ghé và điều kiện bình chọn, nên đã bị xóa.

### 1.3 Game answer payload

Giữ nguyên như v1. Logic tính điểm (`packages/shared/src/scoring.ts`) không thay đổi.

```jsonc
// repick (CORE1)
{ "picked": "B", "stagesViewed": { "A": 4, "B": 4, "C": 2 }, "durationMs": 24000 }
// value (CORE2) — tổng coin phải khớp chính xác. Nếu không trả 400
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

Nếu validation thất bại trả `invalid_answer` (400).

### 1.4 Kết quả

| # | Method · Path | Response | Ghi chú |
|---|---|---|---|
| 10 | `GET /r/:token` | HTML | Trang kết quả mobile |
| 11 | `GET /results/:token` | `{ persona, language, scores, brands[], products[], coupon, expiresAt }` | Hết hạn·đã xóa thì 410 |
| 12 | `DELETE /results/:token` | `{ ok }` | Xóa ngay theo yêu cầu khách |

- Token: random 24 byte base64url (192bit)
- `RESULT_TTL_HOURS` mặc định **48 giờ**, dọn mỗi 10 phút
- **Sản phẩm đề xuất được khôi phục theo kết quả đã chốt tại thời điểm trải nghiệm.** Dù catalog thay đổi sau đó thì kết quả đã phát vẫn cố định

### 1.5 Bình chọn

| # | Method · Path | Request | Response | Xác thực |
|---|---|---|---|---|
| 13 | `GET /vote/:token/options` | — | `{ pickCount, brands[], alreadyVoted, picked[] }` | — |
| 14 | `POST /vote/:token` | `{ productIds: [3 sản phẩm] }` | `{ votedAt }` | — |
| 15 | `GET /vote/:token/status` | — | `{ voted, votedAt?, rewardClaimedAt?, picks[] }` | — |
| 16 | `POST /vote/:token/staff` | `{ pin }` | `{ visitCount, voted, votedAt, rewardClaimedAt }` | **PIN** |
| 17 | `POST /vote/:token/reward` | `{ pin, staff? }` | `{ claimedAt }` | **PIN** |
| 18 | `GET /v/:token` · `/v/:token/done` | — | HTML | — |

**Server-side validation** (không tin client)

| Kiểm tra | Error code |
|---|---|
| Chính xác 3 sản phẩm | `bad_request` |
| Không trùng | `bad_request` |
| **Sản phẩm thực sự tồn tại trong catalog** | `bad_request` |
| Mỗi tài khoản 1 lần | `already_voted` (409) |
| Phát quà trùng | `already_claimed` (409) |

Bình chọn được gắn **với chính tài khoản đã trải nghiệm** theo kết quả token → session → `visitor_id`.

### 1.6 Catalog

| # | Method · Path | Xác thực | Nội dung |
|---|---|---|---|
| 19 | `GET /catalog` | — | Thương hiệu·sản phẩm đang active (cho màn bình chọn) |
| 20 | `GET /catalog/admin` | `X-Admin-Key` | Toàn bộ dữ liệu kể cả inactive |
| 21 | `PUT /catalog/admin/brands/:id` | `X-Admin-Key` | Tạo·sửa thương hiệu |
| 22 | `DELETE /catalog/admin/brands/:id` | `X-Admin-Key` | Xóa (kèm sản phẩm thuộc thương hiệu) |
| 23 | `PUT /catalog/admin/products/:id` | `X-Admin-Key` | Tạo·sửa sản phẩm |
| 24 | `DELETE /catalog/admin/products/:id` | `X-Admin-Key` | Xóa sản phẩm |

> Nếu gắn `Content-Type: application/json` vào `DELETE` không có body, Fastify sẽ chặn bằng 400.
> Client chỉ được gửi authentication header.

### 1.7 Admin

| # | Method · Path | Nội dung |
|---|---|---|
| 25 | `GET /admin/overview` | Trạng thái thiết bị, số tham gia·hoàn tất·rời bỏ hôm nay, thời gian trải nghiệm trung bình |
| 26 | `GET /admin/analytics?from&to` | Điểm trung bình theo trục, phân bố persona, số tham gia theo khung giờ |
| 27 | `GET /admin/sessions?status&page` | Danh sách session |
| 28 | `POST /admin/devices/:id/heartbeat` | `{ battery?, appVersion, state }` |

### 1.8 Trang (HTML)

| Path | Mục đích |
|---|---|
| `/` | Kiosk PAD |
| `/p/:code` | Landing ghép đôi (mock — thực tế sẽ được app thay thế) |
| `/r/:token` | Kết quả mobile |
| `/v/:token` · `/v/:token/done` | Bình chọn · hoàn tất |
| `/admin` · `/admin/catalog` | Dashboard vận hành · quản lý catalog |

---

## 2. Data model

`node:sqlite`(hiện tại) / PostgreSQL(khuyến nghị khi chuyển sang vận hành — tài liệu bàn giao 5-1)

```
visitors ──< sessions ──< answers
   │            │
   │            └──< results ──< votes
   │
   └── số lần ghé

pairings (device_id → session_id)
brands ──< brand_products
devices, events
```

```
visitors                      -- Tài khoản app. Không lưu giá trị gốc
  id TEXT PK                  -- 22 ký tự đầu của SHA-256(salt + appUserId)
  visit_count INT             -- Lần ghé đầu tiên là 1
  first_seen_at / last_seen_at DATETIME

pairings
  code TEXT PK                -- random 9B base64url (12 ký tự)
  device_id TEXT              -- bắt buộc khác nhau giữa các thiết bị
  status TEXT (pending|claimed|expired)
  visitor_id TEXT? · session_id TEXT?
  created_at / expires_at / claimed_at DATETIME

sessions
  id TEXT PK (uuid v4)
  device_id TEXT · visitor_id TEXT?      -- ★ thêm ở v2
  language TEXT (vi|en|ko) · status TEXT (active|completed|abandoned)
  scores JSON? · subtypes JSON? · persona TEXT?
  started_at / completed_at DATETIME

answers
  id PK · session_id FK · core_key TEXT · payload JSON
  score INT · subtype TEXT · answered_at DATETIME
  UNIQUE(session_id, core_key)

results
  token TEXT PK               -- random 24B base64url
  session_id FK UNIQUE · persona TEXT · scores JSON
  product_ids JSON            -- sản phẩm đã chốt tại thời điểm trải nghiệm
  coupon_code TEXT
  expires_at · deleted_at? DATETIME · scan_count INT · download_count INT

votes
  id PK · visitor_id TEXT UNIQUE          -- ★ mỗi tài khoản 1 lần
  session_id? · result_token?
  product_ids JSON            -- 3 sản phẩm
  voted_at DATETIME
  reward_claimed_at? · reward_staff?      -- lịch sử phát quà

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

**Các bảng đã xóa** — `photos`, `image_jobs` (xóa cùng pipeline ảnh·AI)

**Các field đa ngôn ngữ·array** được lưu dạng JSON string. Khi chuyển PostgreSQL khuyến nghị dùng `jsonb`.

**Chính sách lưu giữ·xóa**

| Đối tượng | Chính sách |
|---|---|
| `results` | Tự động xóa sau 48 giờ + xóa ngay theo yêu cầu khách |
| `visitors` | Lưu để thống kê lượt quay lại (chỉ hash, không có dữ liệu gốc) |
| `pairings` | Dọn bản ghi hết hạn mỗi 60 giây |
| `events` · `answers` | Lưu dưới dạng dữ liệu ẩn danh (phục vụ tổng hợp marketing) |

> **Không xử lý ảnh khuôn mặt.** Chính sách xóa ngay ảnh gốc của v1 không còn cần thiết trong v2.

---

## 3. Analytics event

| type | Thời điểm | KPI liên quan |
|---|---|---|
| `pairing.issued` | PAD phát hành QR | Tỷ lệ scan trên số lượt hiển thị |
| `pairing.claimed` {visitCount} | Khách quét QR | **Số lượt bắt đầu trải nghiệm · tỷ lệ quay lại** |
| `pairing.swept` {n} | Dọn code hết hạn | Ước lượng rời đi mà không scan |
| `session.completed` / `session.abandoned` | Kết thúc session | Tỷ lệ hoàn tất, điểm rời bỏ |
| `core.completed` {coreKey, durationMs} | Hoàn tất game | Thời gian trải nghiệm trung bình |
| `qr.issued` / `result.scanned` | Phát QR kết quả·truy cập lần đầu | **Tỷ lệ scan QR kết thúc** |
| `vote.submitted` {productIds} | Hoàn tất bình chọn | **Conversion bình chọn · mức độ ưa thích sản phẩm** |
| `reward.claimed` | Phát quà | Số lượng phát |
| `staff.lookup` | Nhân viên tra số lần quay lại | Audit vận hành |
| `product.clicked` {productId, brandId} | Click sản phẩm đề xuất | CTR |
| `result.shared` {channel} | Chia sẻ | Tỷ lệ chia sẻ |
| `catalog.brand.saved` / `catalog.brand.deleted` | Thay đổi catalog | Audit vận hành |

**Event đã xóa** — `photo.captured`, `photo.retake`, `image.completed`, `image.fallback`, `result.downloaded`, `consent.marketing`

---

## 4. Cấu trúc i18n key

`packages/shared/src/i18n/{vi,en,ko}.json` — vi mặc định, thiếu key thì fallback en.
**Tính nhất quán cây key của 3 ngôn ngữ được ép bằng automated test** (`packages/shared/test/i18n.test.ts`).

```jsonc
{
  "common":  { "next": "…", "start": "…", "confirm": "…", "retry": "…", "timeoutWarn": "…" },
  "attract": { "headline": "…", "sub": "…", "bullets": ["…"],
               "participantsLabel": "…", "topDnaLabel": "…",
               "scanTitle": "…", "scanBody": "…", "scanRetry": "…" },   // ★ thêm ở v2
  "intro":   { "title": "…", "sub": "…" },
  "core1"…"core6": { /* giống v1 */ },
  "dna":     { "analyzing": "…", "analyzingComing": "…", "youAre": "…",
               "personas": { "loyalGlowKeeper": { "name": "…", "desc": "…", "keywords": ["…"] } /* 6 loại */ },
               "percentile": "…" },
  "qr":      { "scanTitle": "…", "retention": "…", "deleteNotice": "…", "finish": "…" },
  "resultWeb": { "title": "…", "share": "…", "couponTitle": "…", "brandsTitle": "…",
                 "voteTitle": "…", "voteDesc": "…", "voteCta": "…", "voteDone": "…",  // ★ thêm ở v2
                 "deleteNow": "…", "expired": "…" },
  "end":     { "thanks": "…" }
}
```

**Block đã xóa** — `consent`, `camera`, `quality`, `reveal`

> **Trang bình chọn·hoàn tất và trang ghép đôi mock không dùng i18n.**
> Nội dung đang hardcode bằng tiếng Hàn trong server HTML. Cần xử lý đa ngôn ngữ trước khi vận hành cho khách Việt Nam.
> (`server/src/votePages.ts`, `server/src/pairingRoutes.ts`)

---

## 5. Interface tích hợp app (adapter)

Vị trí adapter tạo ảnh AI của v1 được thay bằng **adapter xác minh danh tính app**.

```ts
// server/src/identity.ts
interface IdentityProvider {
  readonly name: string;
  /** Xác minh credential gửi từ điện thoại và trả về danh tính. Nếu thất bại trả null (không throw exception) */
  resolve(credential: string): Promise<AppIdentity | null>;
}
interface AppIdentity {
  appUserId: string;    // giá trị gốc. Không lưu, chỉ lưu hash
  language?: string;
}
```

Implementation hiện tại là `mockProvider` — **không xác minh**, coi chuỗi nhận được là tài khoản.
Chỉ cần thay `identityProvider` bằng implementation thực tế, các phần còn lại không cần chỉnh.

```
Luồng claim:
  điện thoại → POST /pairings/:code/claim { credential }
     → identityProvider.resolve(credential)
     → visitorIdOf(appUserId)        // SHA-256(salt + id), không lưu gốc
     → visitors upsert (visit_count + 1)
     → sessions insert (liên kết visitor_id)
     → pairings chuyển atomically sang claimed
```

> ⚠️ **Không được nhận plain user id trực tiếp.** Có thể nhập id người khác để chỉnh số lượt quay lại
> hoặc tiêu mất quyền bình chọn của người khác. Khuyến nghị verify signed token (JWT...) và dùng `sub`.
> Các hạng mục cần thống nhất với team app xem [mục 2 tài liệu bàn giao BE](VN_07_BE_인계문서.md).

---

## 6. Biến môi trường

| Biến | Giá trị mặc định | Mô tả |
|---|---|---|
| `PORT` | 8787 | |
| `HTTPS` | — | Nếu `1`, khởi động bằng self-signed certificate |
| `TUNNEL` | — | Nếu `1`, chạy sau proxy + tự sinh admin key ngẫu nhiên |
| `PUBLIC_BASE_URL` | Suy ra từ request host | Base URL dùng cho QR |
| `ADMIN_KEY` | `aepick-admin` | **Bắt buộc đổi khi vận hành** |
| `STAFF_PIN` | `1234` | **Bắt buộc đổi khi vận hành** |
| `VISITOR_HASH_SALT` | `aepick-dev-salt` | **Bắt buộc đổi khi vận hành** (đổi sẽ làm mất liên kết lịch sử quay lại) |
| `RESULT_TTL_HOURS` | 48 | |
