# AEPICK BEAUTY DNA v2 — Tài liệu bàn giao Backend

> Tài liệu này được tổng hợp để có thể tiếp quản dự án chỉ với một file này.
> Đối tượng: Backend developer sẽ triển khai lên hạ tầng thực tế để vận hành

---

## 1. Hiện tại đã hoàn thành những gì

Đây là trải nghiệm tablet và các trang mobile sau trải nghiệm cho **Core Value Zone của popup Hà Nội**.
Toàn bộ luồng đã hoạt động, và chỉ còn **một điểm tích hợp với aepick app** đang được thay bằng mock.

```
[Vào cửa] Khách quét QR trên màn PAD
   └→ Ghép với tài khoản aepick app          ← ★ chỗ này đang mock (mục 2)
[Trải nghiệm] 6 game trên PAD → xác định Beauty DNA → đề xuất thương hiệu·sản phẩm
[Kết thúc] Hiển thị QR kết quả trên PAD
   └→ khách quét → trang kết quả
[Bình chọn] Sau khi trải nghiệm thương hiệu, chọn 3 sản phẩm trên cùng luồng
[Xác nhận] Nhân viên dùng hidden UI trên trang hoàn tất để kiểm tra số lần quay lại
```

### Tech stack

| Khu vực | Công nghệ sử dụng | Ghi chú |
|---|---|---|
| Server | Node 22+, Fastify 5 | TypeScript, ESM |
| DB | **`node:sqlite`** (built-in Node) | API thử nghiệm. Cần chuyển đổi — mục 5 |
| Kiosk | React 18 + Vite | Static build, server serve cùng |
| Mobile·admin | Server-side HTML string | Không có frontend build riêng |
| Test | vitest 37 test | Tính điểm·persona·tính nhất quán i18n |

### Chạy dự án

```bash
npm install
npm run demo          # build + server (HTTPS, 8787)
npm test
```

Một process duy nhất serve **kiosk·API·mobile·admin trên cùng một port**.

---

## 2. ★ Quan trọng nhất — điểm tích hợp aepick app

**Chỉ cần thay đúng chỗ này bằng implementation thực tế.** Các phần còn lại không cần sửa.

File: **`server/src/identity.ts`**

```ts
export interface IdentityProvider {
  readonly name: string;
  resolve(credential: string): Promise<AppIdentity | null>;
}
```

Hiện đang dùng `mockProvider`, và chuỗi nhận được được **coi thẳng là tài khoản mà không có xác minh**.
Chỉ cần thay `identityProvider` bằng implementation thực tế là xong.

### Các hạng mục cần thống nhất với team app

| # | Hạng mục | Lựa chọn / khuyến nghị |
|---|---|---|
| 1 | Ai quét QR | (a) scanner tích hợp trong app (b) camera điện thoại → mở app bằng deep link |
| 2 | Cách chứng minh danh tính | **Khuyến nghị signed token(JWT)** — xem cảnh báo bên dưới |
| 3 | Field có thể truyền | Bắt buộc: user identifier / tùy chọn: ngôn ngữ ưu tiên |
| 4 | Có thể push khi hoàn tất không | Có thì tốt. Không có vẫn hoàn tất được bằng QR |

> ⚠️ **Không được nhận plain user id trực tiếp.**
> Có thể dùng id người khác để **chỉnh số lần quay lại** hoặc **tiêu mất quyền bình chọn của người khác**.
> Khuyến nghị xác minh signed token và dùng `sub` làm user identifier.

### URL nằm trong QR

```
https://<host>/p/<12-ký-tự pairing code>
```

Hiện URL này mở **trang web pairing mock**.
Trong thực tế có thể thay vị trí này bằng app deep link, hoặc app chỉ đọc code rồi gọi trực tiếp `claim` API.

### Xử lý dữ liệu cá nhân

`visitorIdOf()` lưu account identifier dưới dạng **SHA-256 hash**. Giá trị gốc không được lưu trong DB.
Hãy **bắt buộc đổi `VISITOR_HASH_SALT` trong production**. Nếu đổi sau khi đã vận hành thì lịch sử lượt quay lại cũ sẽ không nối được nữa.

---

## 3. Đặc tả API

Định dạng response chung:
```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

### 3-1. Pairing (bắt đầu trải nghiệm)

| Method | Path | Caller | Mô tả |
|---|---|---|---|
| POST | `/api/pairings` | PAD | Phát code dùng một lần. `{deviceId}` → `{code, url, qrPngUrl, expiresAt, mocked}` |
| GET | `/api/pairings/:code` | PAD | Polling. `{status: pending\|claimed\|expired}` · nếu claimed thì `{sessionId, language, visitCount}` |
| POST | `/api/pairings/:code/claim` | điện thoại/app | `{credential, language}` → `{sessionId, visitCount}` |
| POST | `/api/pairings/cancel` | PAD | `{deviceId}` — hủy code khi khách rời đi |
| GET | `/p/:code` | điện thoại | Trang pairing mock (thực tế sẽ được app thay thế) |

**Thiết kế concurrency (giả định 10 PAD)**

- Code được phát hành **theo từng thiết bị**. Nếu dùng QR cố định, khi hai người quét đồng thời sẽ không thể biết trải nghiệm thuộc PAD nào.
- Claim phân định request thắng bằng **số dòng bị thay đổi** của `UPDATE ... WHERE status='pending'`. Đã xác minh trong 10 request đồng thời chỉ đúng 1 request thành công.
- Nếu cùng PAD phát hành code mới thì code trước lập tức chuyển sang `expired`.
- TTL 3 phút. Dữ liệu hết hạn được dọn mỗi 60 giây.

> **Lưu ý khi bàn giao**: tính atomic này hiện dựa vào cách thực thi tuần tự của single process với `node:sqlite`.
> Nếu tăng server lên nhiều instance, cần **đảm bảo transaction hoặc conditional UPDATE atomic ở DB level**.
> Với PostgreSQL có thể giữ nguyên pattern `UPDATE ... WHERE`.

### 3-2. Trải nghiệm

| Method | Path | Mô tả |
|---|---|---|
| PATCH | `/api/sessions/:id/language` | Xác nhận ngôn ngữ |
| POST | `/api/sessions/:id/answers/:coreKey` | Câu trả lời game. coreKey ∈ `repick, value, care, trend, localFit, trust` |
| POST | `/api/sessions/:id/complete` | Chốt score → persona → result token · QR · thương hiệu/sản phẩm đề xuất |
| GET | `/api/stats/today` | Thống kê màn chờ |
| POST | `/api/events` | Behavior log (gửi dạng array) |

> **Không có route tạo session.** Session chỉ được tạo qua pairing claim.
> Anonymous `POST /api/sessions` của v1 đã bị xóa vì có thể tạo record trải nghiệm không qua QR và bypass thống kê lượt ghé·điều kiện bình chọn.

### 3-3. Kết quả

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/results/:token` | Persona·score·thương hiệu/sản phẩm đề xuất·coupon |
| DELETE | `/api/results/:token` | Xóa ngay theo yêu cầu khách |
| GET | `/r/:token` | Trang kết quả mobile (HTML) |

Kết quả hết hạn sau `RESULT_TTL_HOURS`(mặc định 48) và được dọn mỗi 10 phút.
Sản phẩm đề xuất được **khôi phục theo kết quả đã chốt tại thời điểm trải nghiệm**. Dù catalog thay đổi thì kết quả cũ vẫn giữ nguyên.

### 3-4. Bình chọn

| Method | Path | Xác thực | Mô tả |
|---|---|---|---|
| GET | `/api/vote/:token/options` | — | Toàn bộ thương hiệu đang vận hành và sản phẩm, trạng thái đã bình chọn |
| POST | `/api/vote/:token` | — | `{productIds: [3 sản phẩm]}` |
| GET | `/api/vote/:token/status` | — | Trạng thái bình chọn·các mục đã chọn |
| POST | `/api/vote/:token/staff` | **PIN** | Tra số lần quay lại |
| POST | `/api/vote/:token/reward` | **PIN** | Xử lý phát quà |
| GET | `/v/:token` · `/v/:token/done` | — | Trang bình chọn · hoàn tất |

Server validation: chính xác 3 sản phẩm / không trùng / **chỉ sản phẩm thực sự có trong catalog** / mỗi tài khoản 1 lần.

### 3-5. Catalog · admin

| Method | Path | Xác thực |
|---|---|---|
| GET | `/api/catalog` | — (public) |
| GET | `/api/catalog/admin` | `X-Admin-Key` |
| PUT/DELETE | `/api/catalog/admin/brands/:id` | `X-Admin-Key` |
| PUT/DELETE | `/api/catalog/admin/products/:id` | `X-Admin-Key` |
| GET | `/api/admin/overview` · `analytics` · `sessions` | `X-Admin-Key` |
| GET | `/admin` · `/admin/catalog` | UI (browser lưu key) |

---

## 4. Data model

```
visitors ──< sessions ──< answers
   │            │
   │            └──< results ──< votes
   │
   └── (số lần quay lại)

pairings  (device_id, code, status, → session_id)
brands ──< brand_products
devices, events
```

| Table | Vai trò | Điểm đặc biệt |
|---|---|---|
| `visitors` | Lịch sử ghé theo tài khoản app | **id là hash**. `visit_count` — lần đầu là 1 |
| `pairings` | Code dùng một lần | `UNIQUE(code)`, chuyển trạng thái pending→claimed/expired |
| `sessions` | Một lượt trải nghiệm | Gắn với account bằng `visitor_id` |
| `answers` | Câu trả lời game | `UNIQUE(session_id, core_key)` |
| `results` | Result token | Quản lý hết hạn·xóa |
| `votes` | Bình chọn sản phẩm | **`UNIQUE(visitor_id)` — mỗi tài khoản 1 lần** |
| `brands` / `brand_products` | Catalog | Field đa ngôn ngữ lưu dạng JSON string |
| `events` | Behavior log | Analytics·audit |

Field đa ngôn ngữ(`tagline`, `name`) và array field(`persona_tags`, `product_ids`) hiện được lưu dưới dạng **JSON string**.
Khi chuyển PostgreSQL, khuyến nghị đổi sang `jsonb`.

---

## 5. Các điểm cần xem xét khi chuyển hạ tầng

### 5-1. DB — việc cần làm đầu tiên

`node:sqlite` hiện là **Node experimental API** và sẽ in warning mỗi lần khởi động.
Không phù hợp production nên khuyến nghị **chuyển sang PostgreSQL**.

| Hạng mục | Hiện tại | Khi chuyển |
|---|---|---|
| Driver | `node:sqlite` (sync) | `pg` (async) — **toàn bộ chỗ gọi query phải đổi sang async** |
| JSON field | TEXT | `jsonb` |
| Atomic claim | Single-process serialization | `UPDATE ... WHERE` vẫn dùng được |
| Schema | Một file `server/src/db.ts` | Khuyến nghị thêm migration tool |

DB access đang thống nhất ở dạng `db.prepare(...).run/get/all`, vì vậy có thể thay bằng **một lớp adapter mỏng**.

### 5-2. Quy mô — theo 10 PAD

| Hạng mục | Giá trị | Ghi chú |
|---|---|---|
| Polling load | Khoảng **7 req/s** | 10 PAD × mỗi 1.5 giây |
| API mỗi trải nghiệm | Khoảng 12 lần | Pairing·6 answer·complete... |
| Session/ngày | Cỡ vài trăm | Theo mô hình popup |

Tải không lớn. Tuy nhiên nếu **đổi polling sang SSE hoặc WebSocket** sẽ giảm cả traffic và latency.

### 5-3. Cấu hình thiết bị — thao tác tại hiện trường

**Mỗi PAD bắt buộc có device ID riêng.** Nếu trùng ID thì code pairing sẽ vô hiệu nhau và trải nghiệm bị ngắt.

```
Lần đầu tiên, trên browser của từng PAD mở:
   http://<server>:8787/?device=PAD-03
Sau đó giá trị được lưu vào localStorage. Những lần sau có thể mở không cần parameter.
```

Thiết bị chưa cấu hình sẽ tự nhận random ID để ít nhất vẫn phân biệt được nhau.

### 5-4. Biến môi trường

| Biến | Mặc định | Khi vận hành |
|---|---|---|
| `PORT` | 8787 | |
| `HTTPS` | — | Nếu `1` dùng self-signed certificate. Không cần nếu dùng certificate chuẩn |
| `TUNNEL` | — | Nếu `1` chạy sau proxy + random admin key |
| `PUBLIC_BASE_URL` | Suy ra từ request host | **Khuyến nghị khai báo rõ sau load balancer** |
| `ADMIN_KEY` | `aepick-admin` | **Bắt buộc đổi** |
| `STAFF_PIN` | `1234` | **Bắt buộc đổi** |
| `VISITOR_HASH_SALT` | `aepick-dev-salt` | **Bắt buộc đổi** (đổi sẽ đứt lịch sử lượt quay lại) |
| `RESULT_TTL_HOURS` | 48 | |

Có cấu hình `trustProxy: true` để tin `X-Forwarded-Proto`, nhằm tạo đúng scheme cho QR URL.
Chỉ nên dùng **sau trusted proxy**.

### 5-5. Các hạng mục bảo mật còn lại

| Hạng mục | Hiện trạng | Cần xử lý |
|---|---|---|
| Xác minh danh tính app | **Không có (mock)** | Verify signed token — xem mục 2 |
| Vote API | Ai biết token đều có thể gọi | Result token là random 24 byte nên khó đoán, nhưng vẫn có thể tăng cường binding với session |
| Staff PIN | So sánh đơn giản, không giới hạn số lần thử | Cần **rate limit chống brute force** |
| Nhận quà trùng | Chỉ lưu thời điểm phát | **Chưa giải quyết — mục 6** |
| Admin auth | Một shared key duy nhất | Khuyến nghị auth theo tài khoản |
| Request rate limit | Không có | Bắt buộc nếu expose public |

---

## 6. Hạng mục chưa quyết định (chờ team vận hành)

### 6-1. Chống nhận quà trùng ⚠️

Với cấu trúc hiện tại, có thể **dùng screenshot màn hoàn tất để nhận quà trùng**. Nhân viên khó phân biệt bằng mắt.

Hiện đã có: lưu thời điểm phát + nếu phát lại trả `already_claimed`.
Các column `votes.reward_claimed_at` / `reward_staff` đã chuẩn bị sẵn.

Các hướng có thể xem xét:
- Thêm **thành phần động theo server time** trên màn hoàn tất (code/màu thay đổi mỗi vài giây) để screenshot mất tác dụng
- Nhân viên dùng thiết bị riêng **quét ngược QR** để xử lý phát quà
- Phát **one-time code** riêng cho nhận quà

### 6-2. Kiểm soát thời điểm bình chọn

Hiện từ trang kết quả có thể đi **ngay** sang bình chọn.
Ý đồ trong đặc tả là khách **trải nghiệm thương hiệu trước rồi mới bình chọn**, nên nếu cần có thể thêm staff code hoặc time lock.

### 6-3. Đa ngôn ngữ

- 7 ảnh bridge·kết thúc hiện **chỉ có tiếng Hàn** (xem mục 5 hướng dẫn designer)
- Nội dung tiếng Việt hiện là **machine translation**. Trong `packages/shared/src/i18n/vi.json` có `_note: "[감수 필요]"` — **cần local review**

---

## 7. Cấu trúc code

```
server/src/
  index.ts          Khởi động, đăng ký route, console banner
  db.ts             Schema + migration helper              ← bắt đầu ở đây khi chuyển DB
  identity.ts       ★ adapter tích hợp app (cần thay)
  pairing.ts        Logic pairing (atomic claim)
  pairingRoutes.ts  Pairing API + trang mock
  routes.ts         API trải nghiệm·kết quả
  catalog.ts        CRUD thương hiệu·sản phẩm
  catalogSeed.ts    10 thương hiệu dummy (chỉ seed một lần khi trống)
  catalogRoutes.ts  Catalog API + màn hình admin chỉnh sửa
  voteRoutes.ts     Vote API + staff API
  votePages.ts      Trang bình chọn · hoàn tất
  pages.ts          Trang kết quả · dashboard vận hành
  adminKey.ts       Chính sách admin key
  demoNet.ts        Detect LAN IP · self-signed certificate

packages/shared/src/
  scoring.ts        Tính điểm 6 game (pure function, có test)
  persona.ts        Xác định persona (15 tổ hợp trục)
  content.ts        Constant tính điểm · định nghĩa persona
  i18n/{vi,en,ko}.json

apps/kiosk/src/
  App.tsx           Routing màn hình · timeout policy
  state.tsx         Session state · thứ tự màn hình
  api.ts            API client · device ID
  screens/flow.tsx  Màn chờ~kết thúc
  screens/games.tsx 6 game
```

### Những điều cần biết trước khi chỉnh

**Không dùng `AnimatePresence`.** Nếu exit animation không kết thúc, màn hình trước sẽ không unmount mà tích lũy trong DOM,
khiến timer và toast cũ tiếp tục chạy và gây lỗi. Đây là vấn đề đã xảy ra thực tế ở v1.

**Logic tính điểm được tách thành pure function** và có 37 test. Khi kế hoạch thay đổi chỉ cần sửa `packages/shared/src/`.

---

## 8. Checklist bàn giao

- [ ] Thay `identity.ts` bằng tích hợp app thực tế (mục 2)
- [ ] Đổi `ADMIN_KEY` · `STAFF_PIN` · `VISITOR_HASH_SALT`
- [ ] Chuyển DB sang PostgreSQL (5-1)
- [ ] Thêm giới hạn chống brute force staff PIN
- [ ] Chốt và triển khai phương án chống nhận quà trùng (6-1)
- [ ] Local review tiếng Việt (6-3)
- [ ] Cấu hình device ID cho 10 PAD (5-3)
- [ ] Xử lý đa ngôn ngữ ảnh bridge·kết thúc (mục 5 hướng dẫn designer)
- [ ] Request rate limit · logging · monitoring
