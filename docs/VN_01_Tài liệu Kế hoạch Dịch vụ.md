# AEPICK BEAUTY DNA — Tài liệu hoạch định dịch vụ

> Phiên bản 2.0 · 2026-08-19 · Trạng thái: Đã phản ánh vào triển khai
> Tài liệu hoạch định dịch vụ dựa trên đặc tả vận hành **Core Value Zone** tại popup Hà Nội

---

## 0. Những gì đã thay đổi so với v1

v1 là **trải nghiệm chụp ảnh và tạo hình ảnh bằng AI**.
Ở v2, khi đặc tả vận hành popup được chốt, trải nghiệm đã chuyển thành **kết nối với tài khoản thành viên app và dẫn tới bình chọn sản phẩm**.

| Hạng mục | v1 | v2 |
|---|---|---|
| Nhận diện khách hàng | Ẩn danh | **Tài khoản app aepick** (ghép đôi bằng QR) |
| Chụp ảnh | Có | Không |
| Tạo ảnh AI | Có | Không |
| Kết quả | Ảnh cá nhân hóa | **Đề xuất thương hiệu · sản phẩm phù hợp** |
| Sau trải nghiệm | Kết thúc | **Trải nghiệm thương hiệu → Bình chọn sản phẩm → Quà tặng** |
| Quản lý thương hiệu | 7 hằng số trong code | **Quản lý trên màn hình admin, 10 thương hiệu** |
| Thiết bị | 1 thiết bị | **Quy mô 10 thiết bị** |

**Ý nghĩa của thay đổi này**

- Không còn là trải nghiệm ẩn danh mà **gắn với dữ liệu thành viên**, vì vậy có thể theo dõi lượt quay lại và thực hiện marketing sau đó
- Do không xử lý ảnh khuôn mặt nên **gánh nặng về dữ liệu cá nhân và rủi ro kỹ thuật giảm đáng kể**
- Trải nghiệm trở thành **điểm vào của toàn bộ hành trình popup** — đề xuất để đưa khách tới booth thương hiệu, sau đó thu hồi kết quả qua bình chọn

---

## 1. Định nghĩa dự án

| Hạng mục | Nội dung |
|---|---|
| Tên dự án | AEPICK BEAUTY DNA — Six Picks. One Beauty Identity. |
| Hình thức | Trải nghiệm trên tablet tại Core Value Zone của popup + trang mobile sau trải nghiệm |
| Phần cứng | **Khoảng 10 Android PAD** |
| Thời gian trải nghiệm | Khoảng 4 phút/người |
| Khu vực triển khai | Hà Nội, Việt Nam (mặc định tiếng Việt / tiếng Anh / tiếng Hàn) |

### 1.1 Vị trí trong hành trình tổng thể của popup

```
① Vào cửa   Khách tải và đăng ký app aepick             ← Ngoài phạm vi của chúng ta
② Check-in  Vào Core Value Zone
③ Trải nghiệm Quét QR trên PAD → 6 game → Beauty DNA     ← ★ Phạm vi của chúng ta
④ Đề xuất   QR kết quả → xem thương hiệu phù hợp trên mobile ← ★ Phạm vi của chúng ta
⑤ Trải nghiệm lại Trực tiếp trải nghiệm thương hiệu · sản phẩm trong popup
⑥ Bình chọn Nhân viên hướng dẫn → bình chọn 3 sản phẩm    ← ★ Phạm vi của chúng ta
⑦ Phần thưởng Nhân viên xác nhận rồi phát quà
```

**Trải nghiệm không phải mục đích mà là công cụ.** Đưa khách tới booth thương hiệu (④), sau đó thu lại kết quả trải nghiệm bằng bình chọn (⑥).

### 1.2 Phạm vi triển khai

| # | Thành phần | Trạng thái |
|---|---|---|
| ① | App trải nghiệm trên PAD | Hoàn tất — 14 màn hình, 6 game, ghép đôi |
| ② | Backend API | Hoàn tất — ghép đôi · session · kết quả · bình chọn · catalog |
| ③ | Web mobile kết quả · bình chọn | Hoàn tất |
| ④ | Dashboard vận hành + **quản lý catalog** | Hoàn tất |

**Chỉ còn một phần đang là mock: tích hợp với app aepick.** Sau khi trao đổi xong với team app chỉ cần thay adapter.

---

## 2. Kiến trúc

```
[PAD ×10 — Chrome hoặc WebView]
 └─ Kiosk Web App (React SPA)
        │  Polling ghép đôi / câu trả lời game / hoàn tất
        ▼
[Backend  Node + Fastify  một process · một port]
 ├─ /            Kiosk PAD (serve static build)
 ├─ /p/:code     Landing ghép đôi        ← vị trí sẽ được app thay thế
 ├─ /r/:token    Kết quả mobile
 ├─ /v/:token    Bình chọn sản phẩm
 └─ /admin       Dashboard · quản lý catalog
        │
        ▼
   [DB]  hiện tại node:sqlite → khi vận hành PostgreSQL
```

**Lý do thống nhất một port**: tại hiện trường, quản trị viên chỉ phải xử lý một địa chỉ,
và địa chỉ QR được tạo trực tiếp từ host đang truy cập nên dù môi trường mạng thay đổi cũng không cần sửa ở nơi khác.

### 2.1 Tech stack

| Khu vực | Lựa chọn | Ghi chú |
|---|---|---|
| App PAD | React + TypeScript + Vite | Chuẩn dọc 1200×1920 |
| Animation | Framer Motion | ⚠️ Không dùng `AnimatePresence` — xem mục 3 |
| Backend | Node 22 + Fastify 5 | Thống nhất ngôn ngữ với frontend |
| DB | **`node:sqlite`** → PostgreSQL | Không có dependency native build. Là API thử nghiệm nên cần chuyển đổi |
| Web kết quả · bình chọn | Mobile HTML do server serve | Không có frontend build riêng |
| Tạo QR | Server (qrcode) | |
| Test | vitest 37 test | Tính điểm · persona · tính nhất quán i18n |

> Các dependency **sharp (ghép ảnh) và Gemini (tạo ảnh AI)** của v1 đã được loại bỏ.
> Yêu cầu cấu hình server và các điểm có thể xảy ra lỗi cũng giảm theo.

### 2.2 Cấu trúc repository

```
apps/kiosk/          App trải nghiệm PAD
server/              API + trang kết quả · bình chọn · admin
packages/shared/     Type · logic tính điểm · persona · i18n
docs/                Tài liệu hoạch định · định nghĩa tính năng · API · kiểm thử · hướng dẫn
```

---

## 3. User journey (14 màn hình)

```
S00 Màn hình chờ (QR ghép đôi) ──[Khách quét QR]──> S01 Chọn ngôn ngữ → S05 Hướng dẫn
→ S06~S11 6 game (xen giữa là bridge) → S12 Phân tích DNA
→ S13 Kết quả DNA → S15 QR·đề xuất → S16 Kết thúc → S00

[Mobile]  Trang kết quả → Bình chọn → Hoàn tất bình chọn (nhân viên xác nhận)
```

| Màn hình | Tên | Thành phần chính | Thời gian mục tiêu |
|---|---|---|---|
| S00 | Attract | **QR ghép đôi**, số người tham gia tích lũy, DNA phổ biến | Chờ |
| S01 | Chọn ngôn ngữ | vi(mặc định)/en/ko | 5 giây |
| S05 | Hướng dẫn Core Value | Giới thiệu 6 hành trình | 10 giây |
| S06 | CORE1 Empty Bottle Challenge | Lật card → kéo vào REPICK | 30 giây |
| S07 | CORE2 Beauty Budget | Kéo phân bổ 10 coin | 35 giây |
| S08 | CORE3 Beauty Shield | Giới hạn 10 giây, tap chọn 3 trong 8 card | 25 giây |
| S09 | CORE4 Next Beauty Wave | Swipe 6 card theo 3 hướng | 30 giây |
| S10 | CORE5 Hanoi Weather Lab | Tình huống + kết hợp 5 cặp thuộc tính | 35 giây |
| S11 | CORE6 Review Detective | Chọn 1 trong 3 review | 25 giây |
| SB | Bridge ×6 | Thông điệp thương hiệu theo từng trục (tự động 3 giây) | 18 giây |
| S12 | Phân tích DNA | Hiệu ứng gem xoay | 3.5 giây |
| S13 | Kết quả DNA | Tên type·keyword·radar chart | 15 giây |
| S15 | QR·đề xuất | **QR kết quả**, thương hiệu đề xuất | 30 giây |
| S16 | Kết thúc | Hình ảnh kết thúc → reset | 8 giây |

### 3.1 Hai điểm quan trọng trong thiết kế

**① QR ghép đôi được phát hành mới cho từng lượt trải nghiệm**

Nếu gắn QR cố định trên PAD, khi hai người quét gần như cùng lúc server **không thể xác định ai là người trải nghiệm trên PAD nào.**
Vì vậy màn hình chờ sẽ phát hành mã dùng một lần mỗi lần, và mã bị hủy ngay khi được claim.
Trong môi trường có 10 PAD chạy đồng thời, nếu không có cơ chế này session sẽ bị trộn.

**② QR kết thúc là không thể thay thế**

Sau khi ghép đôi lúc vào cửa, khách **cất điện thoại vào túi.** Không có cách nào tự động bật màn hình điện thoại vào thời điểm trải nghiệm kết thúc.
Vì vậy QR trên màn hình kết thúc là phương tiện duy nhất để gọi khách quay lại điện thoại.

Tuy nhiên do đã ghép đôi nên QR này mạnh hơn QR ẩn danh — khi quét sẽ mở **ngay kết quả của chính người dùng mà không cần đăng nhập**,
và ngay cả khách rời đi mà không quét QR cũng có thể **tìm lại kết quả sau trong app.**

### 3.2 Lưu ý khi phát triển (vấn đề thực tế đã gặp)

**Không dùng `AnimatePresence`.** Nếu exit animation không kết thúc, màn hình trước sẽ không unmount mà tiếp tục tích lũy trong DOM,
khiến **timer và toast của màn hình trước vẫn sống và gây lỗi ở game tiếp theo**.
Đây là lỗi đã thực tế xảy ra trong quá trình kiểm thử v1 nên đã loại bỏ.

---

## 4. Hệ thống Beauty DNA

Giữ nguyên như v1. Logic tính điểm và định nghĩa persona không thay đổi.

### 4.1 Tính điểm theo 6 trục

| Trục | Game nguồn | Ý nghĩa |
|---|---|---|
| Repick | CORE1 | Mức độ hài lòng lâu dài · mua lại |
| Value | CORE2 | Giá trị so với giá tiền |
| Care | CORE3 | Thành phần · độ an toàn · độ tin cậy thông tin |
| Trend | CORE4 | Khả năng tiếp nhận xu hướng |
| Local Fit | CORE5 | Mức độ phù hợp với khí hậu · lối sống địa phương |
| Trust | CORE6 | Review · social proof |

### 4.2 Xác định persona

Dựa trên tổ hợp 2 trục có điểm cao nhất để xác định 6 type:

Loyal Glow Keeper / Smart Beauty Curator / Trend Muse / Local Beauty Expert / Trust Guardian / Beauty Explorer

- Định nghĩa mapping table cho toàn bộ 15 tổ hợp trục (6C2) để **không có tổ hợp nào cho ra kết quả rỗng**
- Không nhắc đến các trục điểm thấp, chỉ mô tả 2 trục cao nhất như thế mạnh
- Công thức được triển khai dưới dạng **pure function** trong `packages/shared/src/` và có unit test

---

## 5. Đề xuất thương hiệu và bình chọn

Đây là giá trị cốt lõi của v2 thay thế vị trí ảnh AI trong v1.

### 5.1 Đề xuất (cá nhân hóa)

- Mỗi thương hiệu được cấu hình **DNA mục tiêu để đề xuất** và **mức độ phù hợp với từng trục**
- Ưu tiên khớp persona → sắp xếp theo độ phù hợp với 2 trục cao nhất để chọn **4 thương hiệu**
- Hiển thị thêm sản phẩm đại diện của từng thương hiệu → dẫn khách đến booth tương ứng

### 5.2 Bình chọn (chung cho tất cả)

- Hiển thị sản phẩm của **toàn bộ 10 thương hiệu đang vận hành tại popup** và cho chọn **3 sản phẩm**
- **Mỗi tài khoản 1 lần** — chặn trùng theo tài khoản app
- Kết quả tổng hợp vừa là KPI vận hành popup vừa là dữ liệu phản hồi cho thương hiệu tham gia

### 5.3 Quản trị viên tự quản lý

Thương hiệu và sản phẩm không nằm trong code mà **được lưu trong DB và chỉnh sửa tại `/admin/catalog`**.
Nếu thương hiệu tham gia thay đổi hoặc có thêm sản phẩm, có thể **xử lý trực tiếp tại hiện trường mà không cần developer**.

---

## 6. Chính sách dữ liệu · quyền riêng tư

| Nguyên tắc | Triển khai |
|---|---|
| **Không thu thập ảnh khuôn mặt** | Ở v2 đã loại bỏ hoàn toàn chụp ảnh · tạo AI |
| Định danh tài khoản app | **Chỉ lưu dưới dạng hash SHA-256**, không lưu giá trị gốc |
| Màn hình đồng ý riêng | Không — thay bằng đồng ý khi đăng ký app |
| URL kết quả | Token ngẫu nhiên 192bit `/r/{token}` |
| Hết hạn kết quả | Tự động xóa sau 48 giờ (giá trị cấu hình) |
| Xóa ngay | Có nút xóa trên trang kết quả |
| Lịch sử quay lại | Tổng hợp theo hash, không có thông tin nhận dạng cá nhân |
| Dữ liệu phân tích | Theo anonymous session ID |

**Rủi ro dữ liệu cá nhân giảm đáng kể so với v1.** Vì không lưu·truyền·tạo ảnh khuôn mặt,
nên gánh nặng tuân thủ quyền riêng tư tại Việt Nam và phạm vi ảnh hưởng khi có sự cố đều giảm.

---

## 7. Tình trạng phát triển

| Giai đoạn | Deliverable | Trạng thái |
|---|---|---|
| V2-1 | Ghép đôi session (QR dùng một lần → claim) | ✅ |
| V2-2 | Adapter tích hợp app + mock | ✅ (tích hợp thực tế sau khi trao đổi với team app) |
| V2-3 | Chỉnh sửa app PAD (loại bỏ ảnh·AI) | ✅ |
| V2-4 | Chuyển catalog sang DB + admin | ✅ |
| V2-5 | Trang kết quả + bình chọn | ✅ |
| V2-6 | Xác nhận quay lại dành cho nhân viên | ✅ |
| V2-7 | Hướng dẫn designer | ✅ |
| V2-8 | Tài liệu bàn giao BE | ✅ |

---

## 8. Hạng mục ngoài phạm vi

- Android Lock Task Mode / quản lý thiết bị (giai đoạn riêng)
- Tích hợp Shopee·TikTok Shop thực tế (chỉ triển khai vị trí link)
- Hệ thống phát coupon thực tế (coupon mock chỉ để hiển thị)
- Tích hợp CRM
- CDN / S3

---

## 9. Rủi ro và phương án xử lý

| Rủi ro | Phương án | Trạng thái |
|---|---|---|
| **Cách tích hợp app chưa chốt** | Cô lập bằng adapter, hoàn thiện toàn bộ luồng bằng mock | Chờ trao đổi với team app |
| **user id dạng plain text có thể bị giả mạo/chỉnh sửa** | Khuyến nghị xác minh signed token (mục 2 tài liệu bàn giao) | Chờ trao đổi với team app |
| **Nhận quà trùng lặp** | Vẫn có khả năng tái sử dụng screenshot | **Team vận hành chưa quyết định** |
| Lẫn session khi 10 PAD chạy đồng thời | Mã riêng theo thiết bị + claim nguyên tử | ✅ Đã kiểm chứng |
| Trùng PAD device ID | Chỉ định 1 lần bằng `?device=PAD-03` | Cần thao tác tại hiện trường |
| Hình bridge·kết thúc cố định tiếng Hàn | Tạo theo từng ngôn ngữ hoặc tách text | **Designer cần xử lý** |
| Nội dung tiếng Việt chưa được review | Hiện là machine translation | **Cần kiểm duyệt bản địa** |
| API thử nghiệm `node:sqlite` | Chuyển PostgreSQL | Khi bàn giao BE |

---

## 10. Bước tiếp theo

**Những việc cần quyết định trước khi bàn giao** (không phải phía chúng ta có thể tự quyết)

1. 10 thương hiệu thực tế và danh sách sản phẩm → team vận hành nhập vào admin
2. 4 hạng mục về cách tích hợp app aepick → trao đổi với team app ([mục 2 tài liệu bàn giao](VN_07_BE_인계문서.md))
3. Cách chống nhận quà trùng → team vận hành quyết định
4. Hình bridge·kết thúc đa ngôn ngữ → designer ([mục 5 hướng dẫn designer](VN_06_디자이너_가이드.md))
5. Kiểm duyệt tiếng Việt bản địa → team vận hành

**Nâng cấp sau đó**

- Android shell (Lock Task Mode, tự động phục hồi, giám sát thiết bị)
- Chuyển PostgreSQL + hỗ trợ nhiều instance
- Polling → SSE/WebSocket
- Rate limit · logging · monitoring
