# AEPICK BEAUTY DNA v2 — Báo cáo kiểm thử

> Phiên bản 2.0 · 2026-08-19 · Trạng thái: Hoàn tất
> Đối tượng: sản phẩm triển khai v2 (app PAD · backend · mobile kết quả·bình chọn · admin catalog)
> Môi trường: Windows 10 / Node 24 / trình duyệt Chromium / local server

---

## 1. Phạm vi và phương pháp kiểm thử

| Layer | Phương pháp | Công cụ |
|---|---|---|
| Logic tính điểm·persona·i18n | Unit test | vitest |
| Concurrency pairing | Bơm request song song rồi đối chiếu DB | curl chạy song song + đọc trực tiếp SQLite |
| API | Scenario smoke test | curl + Node |
| Hành vi màn hình | Browser automation (thao tác DOM thật) | Công cụ trình duyệt |
| Hidden UI | Phát pointer event trực tiếp | Công cụ trình duyệt |
| Chức năng đã xóa | Xác nhận endpoint trả 404 | curl |

> **Các interaction của 6 game không thay đổi trong v2 nên không chạy lại toàn bộ.**
> Logic tính điểm và game component giữ nguyên từ v1 và đã có unit test, vì vậy phần sau game được kiểm thử qua API.

---

## 2. Tóm tắt kết quả

### 2.1 Unit test — ✅ 37/37 pass

| Suite | Hạng mục | Kết quả |
|---|---|---|
| scoring.test.ts | 25 case công thức 6 game (bao gồm boundary·validity) | ✅ |
| persona.test.ts | 8 case gồm toàn bộ 15 tổ hợp·rule hòa điểm·rarity | ✅ |
| i18n.test.ts | 4 case kiểm tra cây key vi/en/ko khớp hoàn toàn·giá trị rỗng | ✅ |

### 2.2 Pairing — ✅ (kiểm thử trọng yếu với giả định 10 PAD)

| # | Hạng mục | Kết quả |
|---|---|---|
| P1 | Phát hành → polling(pending) → claim → polling(claimed) | ✅ |
| P2 | Thử lại code đã claim | ✅ `already_claimed` |
| P3 | **10 request claim đồng thời** | ✅ **1 thành công / 9 bị từ chối** |
| P4 | Cùng PAD phát hành lại thì code cũ vô hiệu | ✅ `expired` |
| P5 | **10 PAD vận hành đồng thời** | ✅ 10 session riêng biệt, 0 trường hợp lệch thiết bị-session |
| P6 | Đếm lượt quay lại | ✅ 1 → 2 → 3 → 4 (**lần đầu = 1**) |
| P7 | Không lưu account id gốc | ✅ Xác nhận chỉ lưu hash (`1WphRVENZtdgxTorIn3OoS`) |
| P8 | Code TTL | ✅ 180 giây |

> **P3·P5 là kiểm thử quan trọng nhất ở phiên bản này.** Nếu dùng QR cố định thì khi hai khách quét gần cùng lúc
> session có thể bị trộn. Đã xác nhận atomic claim chỉ cho đúng một người đi qua.

### 2.3 Luồng màn hình PAD — ✅

| # | Hạng mục | Kết quả |
|---|---|---|
| K1 | Màn chờ hiển thị QR pairing · text 3 ngôn ngữ | ✅ |
| K2 | Điện thoại claim → **PAD tự động chuyển sang chọn ngôn ngữ** | ✅ |
| K3 | Ngôn ngữ → intro (đi thẳng, không qua đồng ý·chụp ảnh) | ✅ |
| K4 | Vào game1 | ✅ |
| K5 | API đoạn kết (persona·QR·sản phẩm đề xuất) | ✅ |
| K6 | Tách device ID (`?device=PAD-01` → localStorage) | ✅ |

### 2.4 Chức năng đã xóa — ✅ toàn bộ 404

| Endpoint | Kết quả |
|---|---|
| `POST /api/sessions/:id/photo` | ✅ 404 |
| `GET /api/sessions/:id/image-status` | ✅ 404 |
| `PATCH /api/sessions/:id/consent` | ✅ 404 |
| `POST /api/sessions` (tạo anonymous session) | ✅ 404 |
| Field ảnh trong response kết quả | ✅ Đã xóa |

### 2.5 Catalog·admin — ✅

| # | Hạng mục | Kết quả |
|---|---|---|
| C1 | Seed | ✅ 10 thương hiệu · 30 sản phẩm |
| C2 | Admin auth | ✅ Không có key: 401 / có key: 200 |
| C3 | **Sửa tên thương hiệu trên UI → phản ánh lên server** | ✅ |
| C4 | Thêm → xóa thương hiệu (xóa kèm sản phẩm thuộc thương hiệu) | ✅ |
| C5 | Recommendation phản ánh catalog | ✅ trustGuardian → PURE LAB, HERB FOLK, PROVEN KIT, DAILY ROUTINE |
| C6 | Nguyên tắc cố định kết quả (catalog đổi nhưng kết quả đã phát không đổi) | ✅ |

### 2.6 Bình chọn — ✅

| # | Hạng mục | Kết quả |
|---|---|---|
| V1 | Hiển thị option | ✅ 10 thương hiệu · 30 sản phẩm |
| V2 | **Giới hạn 3 sản phẩm** (chọn thứ 4 thì thông báo và chặn) | ✅ |
| V3 | Submit → trang hoàn tất (3 sản phẩm + tên thương hiệu) | ✅ |
| V4 | **Mỗi tài khoản 1 lần** | ✅ `already_voted` |
| V5 | Kiểm tra số lượng (submit 2 sản phẩm) | ✅ `bad_request` |
| V6 | Sản phẩm trùng | ✅ `duplicate product` |
| V7 | **Inject product id không có trong catalog** | ✅ `unknown product` |
| V8 | Token sai | ✅ `not_found` |

> V7 xác nhận server không tin client. Không thể chèn id tùy ý để làm sai lệch kết quả tổng hợp.

### 2.7 UI chỉ dành cho nhân viên — ✅

| # | Hạng mục | Kết quả |
|---|---|---|
| S1 | **Tap ngắn không mở** | ✅ (tránh khách vô tình chạm) |
| S2 | Nhấn giữ 1.2 giây → mở | ✅ |
| S3 | Sai PIN | ✅ Từ chối |
| S4 | Đúng PIN → hiển thị số lần quay lại | ✅ |
| S5 | Xử lý phát quà → khóa nút + thay thông báo cho khách | ✅ |
| S6 | Thử phát lại | ✅ `already_claimed` |
| S7 | Tra lượt quay lại không có PIN | ✅ 401 |

### 2.8 Trang kết quả mobile — ✅

| # | Hạng mục | Kết quả |
|---|---|---|
| R1 | CTA bình chọn → `/v/:token` (không cần quét lại QR) | ✅ |
| R2 | Dư âm nút tải ảnh AI | ✅ Không có |
| R3 | i18n key chưa resolve | ✅ Không có |
| R4 | Result TTL | ✅ 48 giờ |

---

## 3. Lỗi phát hiện và đã sửa trong quá trình kiểm thử

| # | Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|---|
| **E1** | **v2 dùng code của v1** — sửa i18n nhưng UI không thay đổi | Khi copy `node_modules` từ v1, symbolic link `@aepick/shared` vẫn trỏ tới **absolute path của thư mục v1** | Chạy lại `npm install` trong v2 để sửa workspace link. Sau đó chạy lại toàn bộ type check·test·build |
| **E2** | Truy vấn kết quả trả 500 | Vẫn query column `sessions.nickname` đã bị xóa ở V2-3 | Xóa reference |
| **E3** | **Nút xóa trên admin không hoạt động** | `DELETE` không có body nhưng lại gắn `Content-Type: application/json`, Fastify trả 400 | Request xóa chỉ gửi authentication header |
| **E4** | Route tạo anonymous session còn sót | `POST /api/sessions` của v1 vẫn tồn tại dù không có caller, có thể **tạo record trải nghiệm không qua QR và bypass thống kê lượt ghé·điều kiện bình chọn** | Xóa route |
| **E5** | Dư âm chức năng cũ trên trang kết quả | AI image hero·4 nút download·reference `reasonKey` không còn tồn tại | Xóa. Nếu giữ lại sẽ hiển thị key lỗi trên UI |

### Điểm cần nhấn mạnh

**E1 được phát hiện nhờ cách kiểm thử thực tế.** Type check và test đều pass nhưng **khi nhìn trực tiếp trên browser**
thấy text không đổi nên mới phát hiện. Nếu chỉ chạy automated check thì toàn bộ v2 có thể được build bằng code v1.

**E3 cũng tương tự.** Dùng curl thì xóa thành công nên API trông có vẻ bình thường, nhưng **thao tác nút trực tiếp trên UI**
mới phát hiện lỗi.

**E4 được phát hiện khi rà lại danh sách API trong quá trình viết tài liệu.** Vì không có caller nên loại lỗi này không lộ ra trong functional test thông thường.

---

## 4. Rủi ro còn lại và giới hạn đã biết

| Hạng mục | Nội dung | Cách xử lý |
|---|---|---|
| **Chưa kiểm thử tích hợp app** | Hiện là mock. Chuỗi bất kỳ đều được coi là account | Sau khi trao đổi với team app thì thay adapter |
| **Plain id có thể bị giả mạo/chỉnh sửa** | Ở trạng thái mock có thể dùng id người khác để chỉnh số lượt quay lại | Khuyến nghị xác minh signed token |
| **Nhận quà trùng** | Vẫn có khả năng tái sử dụng **screenshot màn hoàn tất** | **Team vận hành chưa quyết định** |
| Brute-force staff PIN | Không có giới hạn số lần thử | Bổ sung khi bàn giao BE |
| Chưa kiểm thử thiết bị thật | Chưa xác nhận trên Android PAD thực tế | Cần rehearsal tại hiện trường |
| 6 game chưa chạy lại trên v2 | Do không thay đổi so với v1 nên chỉ xác nhận qua API | Kiểm tra cùng trong rehearsal hiện trường |
| Ảnh bridge·kết thúc | **Text tiếng Hàn được đóng trực tiếp trong ảnh** | Designer cần xử lý |
| Text trang bình chọn·hoàn tất | Hardcode tiếng Hàn (chưa i18n) | Cần xử lý trước vận hành |
| Nội dung tiếng Việt | Hiện là machine translation | Cần local review |
| `node:sqlite` | Cảnh báo API thử nghiệm của Node | Chuyển PostgreSQL |
| Multi-instance | Atomic pairing **phụ thuộc vào single-process serialization** | Khi scale cần đảm bảo ở DB level |

---

## 5. Mức độ sẵn sàng đo KPI

| KPI | Event/metric | Trạng thái |
|---|---|---|
| Số lượt bắt đầu trải nghiệm | `pairing.claimed` | ✅ |
| **Tỷ lệ quay lại** | `visitors.visit_count` | ✅ |
| Tỷ lệ scan trên QR được hiển thị | `pairing.issued` ↔ `pairing.claimed` | ✅ |
| Tỷ lệ hoàn tất | `session.completed` / `abandoned` | ✅ |
| Thời gian trải nghiệm trung bình | `started_at` ↔ `completed_at` | ✅ |
| Tỷ lệ scan QR kết thúc | `qr.issued` ↔ `result.scanned` | ✅ |
| **Conversion bình chọn** | `vote.submitted` | ✅ |
| **Tổng hợp mức độ ưa thích sản phẩm** | `votes.product_ids` | ✅ |
| Số lượng quà đã phát | `reward.claimed` | ✅ |
| Tỷ lệ click sản phẩm | `product.clicked` | ✅ |
| Tỷ lệ chia sẻ | `result.shared` | ✅ |
| Tỷ lệ sử dụng coupon | Chỉ đo phát hành, **việc sử dụng cần POS integration** | ⚠ |

**KPI đã xóa** — tỷ lệ chụp lại, tỷ lệ tạo AI thành công, tỷ lệ download, tỷ lệ đồng ý CRM (không còn chức năng tương ứng ở v2)

---

## 6. Kết luận

Đã xác nhận **toàn bộ thành phần của v2 hoạt động theo đặc tả vận hành popup**.

Các phần cốt lõi với giả định 10 PAD là **pairing concurrency** (10 claim đồng thời chỉ 1 thành công, 0 trường hợp lệch device-session)
và **tính toàn vẹn bình chọn** (mỗi tài khoản 1 lần, chặn product id tùy ý) đều đã được kiểm chứng, và 5 lỗi phát hiện đều đã sửa.

Tuy nhiên còn ba hạng mục **không thể tự hoàn tất phía chúng ta**:

1. **Tích hợp app** — cần trao đổi với team app. Mock hiện tại không có xác minh nên không thể dùng production
2. **Chống nhận quà trùng** — cần team vận hành quyết định
3. **Đa ngôn ngữ** — ảnh bridge·kết thúc và trang bình chọn vẫn là tiếng Hàn. Bắt buộc xử lý trước khi vận hành cho khách Việt Nam

Về kỹ thuật, trạng thái hiện tại đủ để bàn giao; sau khi ba hạng mục trên được chốt có thể chuyển sang giai đoạn triển khai hiện trường.
