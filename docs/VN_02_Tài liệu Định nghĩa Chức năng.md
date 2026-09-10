# AEPICK BEAUTY DNA — Tài liệu định nghĩa chức năng

> Phiên bản 2.0 · 2026-08-19 · Trạng thái: Đã phản ánh vào triển khai
> Dựa trên nội dung đã chốt của tài liệu hoạch định dịch vụ (01). Định nghĩa đặc tả màn hình · quy tắc game · công thức tính điểm · mapping persona
> Xem cấu trúc API·dữ liệu trong [03 API·đặc tả dữ liệu](VN_03_API_데이터명세.md).

---

## 0. Thay đổi màn hình so với v1

| Hạng mục | v1 | v2 (14 màn hình) |
|---|---|---|
| Bắt đầu | Nút START → anonymous session | **Quét QR → ghép đôi tài khoản app** |
| Đồng ý (S02) | 5 mục + avatar mode | **Xóa** — thay bằng đồng ý khi đăng ký app |
| Chụp ảnh (S03·S04) | Chụp khuôn mặt + kiểm tra chất lượng | **Xóa** |
| Reveal (S14) | Công bố ảnh AI | **Xóa** |
| Kết quả | Ảnh cá nhân hóa | **Đề xuất thương hiệu·sản phẩm** |
| Sau khi kết thúc | — | **Bình chọn sản phẩm trên mobile** (mới) |

---

## 1. Quy tắc chung

### 1.1 Chung cho màn hình

| Hạng mục | Quy tắc |
|---|---|
| Độ phân giải chuẩn | 1200 × 1920 (dọc), hỗ trợ độ phân giải khác bằng viewport scaling |
| Touch target | Tối thiểu 64×64px |
| Hiển thị tiến độ | Cố định ở đầu màn hình game: 6 gem (`● ● ● ○ ○ ○`) + `{n} of 6 · Your Beauty DNA is blooming` |
| Hiệu ứng hoàn thành game | Bật sáng 1 gem(0.8 giây) → toast hoàn thành(2 giây) → tự động chuyển sang bridge |
| Quay lại | Không có (luồng một chiều) |
| Gesture cho vận hành | Tap liên tục 5 lần vào góc trên bên trái → xác nhận → reset session cưỡng bức |
| **Nhận diện thiết bị** | Mỗi PAD phải có ID khác nhau. Lần đầu mở bằng `?device=PAD-03` để lưu |

> **Device ID không được trùng nhau.** Các PAD cùng ID sẽ làm vô hiệu mã ghép đôi của nhau,
> khiến khách quét QR nhưng trải nghiệm không bắt đầu.

### 1.2 Chính sách timeout

| Màn hình | Giới hạn không thao tác | Hành động |
|---|---|---|
| S00 Attract | Không có | Đây là trạng thái không có khách nên không áp dụng |
| S01 ngôn ngữ, S05 intro, S13 kết quả, S15 QR | 60 giây | Ở giây 50 hiển thị modal cảnh báo(đếm ngược 10 giây) → không phản hồi thì hủy session → S00 |
| S06~S11 game | 90 giây | Ở giây 80 hiển thị modal cảnh báo → nếu hủy thì về S00 |
| (Chung) modal cảnh báo | — | 2 nút [Tiếp tục] / **[Quay lại từ đầu]** |
| S08 (giới hạn trong game) | Có rule riêng 10 giây | Hết 10 giây thì tính điểm theo phần đã chọn |
| SB bridge, S12 phân tích | Hệ thống tự chạy | Không cần input |
| S16 kết thúc | 8 giây | Tự động quay lại S00 |

Khi hủy session, gửi event `session.abandoned` lên server.
**Quy tắc "xóa ngay ảnh đã upload" của v1 không còn áp dụng vì không còn xử lý ảnh.**

### 1.3 State machine

```
IDLE(chờ ghép đôi) ──[QR được claim]──> LANGUAGE → INTRO
     → GAME_1 …(bridge)… GAME_6 → ANALYZING → DNA_RESULT → QR → END → IDLE
Ở bất kỳ trạng thái nào: TIMEOUT / OPERATOR_RESET → IDLE

[Mobile — độc lập với PAD]
  Trang kết quả → Bình chọn → Hoàn tất bình chọn(UI xác nhận nhân viên)
```

---

## 2. Đặc tả chi tiết từng màn hình

### S00. Attract (màn hình chờ + ghép đôi)

- **Layout**: wordmark / headline / thống kê người tham gia hôm nay·DNA phổ biến / hướng dẫn 3 bước / **card QR ghép đôi ở dưới**
- **Dữ liệu**: `GET /api/stats/today` → tổng người tham gia, type DNA nhiều nhất hôm nay
- **Hành vi ghép đôi**
  1. Khi vào màn hình gọi `POST /api/pairings` để phát hành **mã dùng một lần** → hiển thị QR
  2. **Polling mỗi 1.5 giây** (`GET /api/pairings/:code`)
  3. Khi khách quét QR và liên kết tài khoản app, trạng thái → `claimed` → nhận session ID·số lần ghé → S01
  4. Khi mã hết hạn(3 phút), tự động phát hành mã mới — ngay cả khi PAD bị bỏ không thì QR luôn hợp lệ
  5. Nếu phát hành thất bại, retry sau 5 giây
- **Chuyển màn hình**: tự động → S01 khi phát hiện claimed (không có nút)

### S01. Chọn ngôn ngữ

- 3 card lớn: Tiếng Việt(mặc định, trên cùng) / English / 한국어
- Nếu tài khoản app có ngôn ngữ ưu tiên thì dùng làm lựa chọn mặc định
- Áp dụng ngay ngôn ngữ đã chọn cho toàn UI → [NEXT] → `PATCH /api/sessions/:id/language` → S05

> **Session đã được tạo từ bước ghép đôi.** Màn hình này chỉ xác nhận ngôn ngữ.

### S05. Hướng dẫn Core Value

- Intro với 6 gem bố trí hình tròn + "Qua sáu lựa chọn, chúng tôi sẽ tìm ra Beauty DNA của riêng bạn"
- [Bắt đầu] → S06

### S06~S11. Game (→ xem mục 3)

### SB. Thông điệp thương hiệu (bridge) — màn hình tự động chuyển giữa các game

Sau khi toast hoàn thành game kết thúc, hiển thị trong **3 giây** màn hình truyền tải ý nghĩa của trục vừa đo đối với AEPICK,
sau đó tự động chuyển sang game tiếp theo. Áp dụng cho cả 6 game.

```
Game1 → bridge(repick) → Game2 → bridge(value) → … → Game6 → bridge(trust) → Phân tích DNA
```

| Bridge | Nội dung chính |
|---|---|
| repick | Không phải một lần chọn mà là **sự hài lòng khiến người dùng quay lại** |
| value | Không phải sản phẩm rẻ mà là **sản phẩm thực sự xứng đáng với giá tiền** |
| care | Không phải vẻ hào nhoáng bên ngoài mà là **tiêu chuẩn có thể yên tâm sử dụng** |
| trend | Không phải thứ đang nổi tiếng lúc này mà là **vẻ đẹp sắp được yêu thích** |
| localFit | Không phải sản phẩm nổi tiếng tại Hàn Quốc mà là **sản phẩm phù hợp với đời sống tại Việt Nam** |
| trust | Không phải vì xuất hiện nhiều mà là **câu chuyện rằng nó thực sự tốt** |

- Do bản thiết kế là **hình hoàn chỉnh có cả nội dung text**, hiển thị nguyên ảnh full-screen
  (`assets/ui/bridge-<key>.jpg`, rộng 1200px · khoảng 220KB/ảnh)
- **Không có input** — loại khỏi timeout không thao tác
- ⚠️ Hiện nội dung **tiếng Hàn được đóng trực tiếp vào ảnh**, nên chỉ màn bridge bị cố định tiếng Hàn.
  Cần xử lý trước khi vận hành cho khách Việt Nam ([mục 5 hướng dẫn designer](VN_06_디자이너_가이드.md))

### S12. Phân tích DNA

- Hiệu ứng 6 gem xoay quanh DNA orb
- Khi vào màn hình gọi `POST /api/sessions/:id/complete` → nhận score·persona·thương hiệu đề xuất·QR kết quả
- **Thời gian phát tối thiểu 3.5 giây**
  (v1 chờ 8 giây để tạo ảnh AI. Ở v2 không còn tạo ảnh nên chỉ giữ nhịp hiệu ứng)
- Nếu server response thất bại thì dùng điểm tính local để tiếp tục (offline fallback)
- Chuyển tự động → S13

### S13. Kết quả DNA

- Công bố persona bằng typography lớn + mô tả 2 dòng
- 3 chip keyword / radar chart 6 trục / "Chỉ {p}% người tham gia hôm nay có DNA này"
- [Tiếp theo] → S15

### S15. QR·đề xuất

- QR code(`https://…/r/{token}`) + "Scan to keep your Beauty DNA"
- Hiển thị thương hiệu·sản phẩm đề xuất
- Ghi chú dưới QR: lưu 48 giờ / có thể xóa ngay trên trang kết quả
- [Kết thúc trải nghiệm] hoặc timeout 60 giây → S16

> **QR này là phương tiện duy nhất gọi khách quay lại điện thoại.**
> Khách đã cất điện thoại sau khi ghép đôi lúc vào cửa nên không thể tự động bật màn hình ở thời điểm kết thúc.

### S16. Kết thúc·reset

- Hiển thị hình thiết kế kết thúc full-screen (`assets/ui/end-final.jpg`)
- Xóa hoàn toàn local session data → sau 8 giây về S00 (phát hành QR ghép đôi mới)
- ⚠️ Tương tự bridge, đây là **ảnh có text tiếng Hàn đóng sẵn**

---

## 2-B. Màn hình mobile (độc lập với PAD)

Khách tiếp tục trên điện thoại sau khi quét QR kết thúc.

### M1. Trang kết quả `/r/:token`

- Persona · mô tả · keyword
- **[Đi bình chọn]** — nếu đã bình chọn thì hướng tới trang hoàn tất
- Mã coupon popup
- Thương hiệu phù hợp DNA và sản phẩm của từng thương hiệu (SHOP link)
- Thông báo hết hạn sau 48 giờ + [Xóa ngay]

### M2. Trang bình chọn `/v/:token`

- Danh sách **toàn bộ** thương hiệu đang vận hành popup và sản phẩm tương ứng
- Chọn **chính xác 3 sản phẩm** (khi chọn thứ 4 thì thông báo và chặn)
- Thanh cố định phía dưới hiển thị số đã chọn, chỉ khi đủ 3 mới bật [Bình chọn]
- Tài khoản đã bình chọn sẽ được chuyển ngay tới trang hoàn tất
- **Server validation**: số lượng · trùng lặp · sản phẩm có tồn tại trong catalog · mỗi tài khoản 1 lần

> **Bình chọn được gắn với chính tài khoản đã trải nghiệm.** Liên kết theo kết quả token → session → visitor.

### M3. Trang hoàn tất bình chọn `/v/:token/done`

- Xác nhận hoàn tất + 3 sản phẩm đã chọn (kèm tên thương hiệu)
- "Hãy đưa màn hình này cho nhân viên"

**Khu vực chỉ dành cho nhân viên (ẩn)**

| Hạng mục | Quy tắc |
|---|---|
| Vị trí | Vùng trong suốt 64×64 ở góc dưới bên phải |
| Cách mở | **Nhấn giữ 1.2 giây** (tap ngắn không mở) |
| Xác thực | PIN (`STAFF_PIN`) |
| Hiển thị | **Đây là lần ghé thứ mấy của khách** — lần đầu là 1 |
| Thao tác | [Xử lý phát quà] — chỉ 1 lần, thử lại trả `already_claimed` |

> Lý do dùng **nhấn giữ** thay vì tap ngắn: màn hình hoàn tất là màn khách cầm để đưa cho nhân viên,
> nên nếu tap ngắn rất dễ vô tình mở khi cuộn, làm lộ số lần quay lại.

> ⚠️ **Chưa giải quyết** — vẫn có khả năng dùng screenshot màn hoàn tất để nhận quà trùng.
> Hiện mới chỉ lưu thời điểm phát và chặn phát lại trên server.

### M4. Quản lý catalog `/admin/catalog` (vận hành)

- Thương hiệu: tên · emoji · giới thiệu 3 ngôn ngữ · DNA mục tiêu đề xuất · độ phù hợp trục · bật/tắt hiển thị · đường dẫn logo
- Sản phẩm: tên 3 ngôn ngữ · giá · link mua · hiển thị · đường dẫn ảnh
- Thêm · sửa · xóa (xóa thương hiệu sẽ xóa luôn sản phẩm thuộc thương hiệu)
- Lưu là phản ánh ngay lên màn kết quả·bình chọn (không cần build)

---

## 3. Quy tắc chi tiết và tính điểm của 6 game

> Mỗi game đều cho ra **điểm trục chính(0~100)** và **subtype(dùng cho nội dung kết quả)**.
> Công thức được triển khai dưới dạng pure function trong `packages/shared` và có unit test.

### CORE 1 — EMPTY BOTTLE CHALLENGE (trục: Repick)

**Nội dung**: 3 sản phẩm giả lập. Mỗi sản phẩm có 4 bước thông tin (cảm giác lần đầu → sau 7 ngày → sau 1 tháng → chai rỗng).

| Sản phẩm | Profile | Tóm tắt câu chuyện 4 bước |
|---|---|---|
| A. Viral Glow Serum | Hài lòng tức thời·viral, giảm hài lòng dài hạn | Ấn tượng đầu rất tốt → dần trở nên bình thường → cân nhắc mua lại |
| B. Steady Barrier Cream | Ấn tượng đầu bình thường, hiệu quả dài hạn tăng | Khởi đầu bình thường → càng dùng da càng thoải mái → hài lòng khi dùng hết |
| C. Classic Daily Lotion | Bestseller quen thuộc, ổn định | Cảm giác an toàn quen thuộc → sự hài lòng không đổi |

**Luồng**: Hiển thị 3 product card → tap để xem 4 bước thông tin → kéo 1 sản phẩm cuối cùng vào vùng REPICK.

**Tính điểm**
```
base:  B = 90 | C = 72 | A = 45
Bonus khám phá: nếu xem hết 4 bước của ít nhất 2 sản phẩm thì +8 (tối đa 100)
Repick = min(100, base + bonus)
```
**Subtype**: B→coi trọng hiệu quả dài hạn / C→ưu tiên sản phẩm quen thuộc / A + xem toàn bộ→xu hướng khám phá sản phẩm mới / A + chưa xem→coi trọng thỏa mãn tức thời

**Thông điệp hoàn tất**: "Bạn chọn sản phẩm có thể mang lại sự hài lòng lâu dài hơn là sự nổi tiếng nhất thời." (3 biến thể theo lựa chọn)

### CORE 2 — BEAUTY BUDGET (trục: Value)

**Luồng**: Kéo phân bổ 10 Beauty Coin vào 8 slot giá trị (tối đa 4 coin/slot). Hiển thị coin còn lại theo thời gian thực. Khi phân bổ đủ 10 coin thì bật [Hoàn tất]. Nền bàn trang điểm thay đổi theo cách phân bổ.

**Trọng số giá trị (hệ số hợp lý)**

| Slot | Hiệu quả | Thành phần | Giá hợp lý | Dung tích | Quà tặng | Thương hiệu | Bao bì | KOL đề xuất |
|---|---|---|---|---|---|---|---|---|
| w | 1.0 | 0.9 | 1.0 | 0.8 | 0.5 | 0.4 | 0.3 | 0.2 |

```
Value = round( Σ(coin_i × w_i) / 10 × 100 )   // phạm vi lý thuyết 20~100
```
**Subtype**: thực dụng(hiệu quả+giá+dung tích ≥ 6 coin) / premium(thương hiệu+bao bì+thành phần ≥ 5) / ưu đãi(quà tặng+KOL ≥ 4) / cân bằng(còn lại). Nếu thỏa nhiều điều kiện thì chọn bên có tổng coin lớn hơn.

**Thông tin toàn bộ người tham gia**: sau khi hoàn tất hiển thị "Hôm nay người tham gia trung bình đầu tư nhiều coin nhất vào '{slot nhiều nhất}'" (tổng hợp server, bỏ qua nếu server fail)

### CORE 3 — BEAUTY SHIELD (trục: Care)

**Luồng**: Hiển thị grid 8 card → timer 10 giây → tap chọn 3 tín hiệu đáng tin cậy → [Tiếp theo].
Khi chọn đủ 3 thì timer dừng, nếu hết giờ thì tính điểm phần đã chọn (luôn cho phép tiếp tục).

> **Nguyên tắc hiển thị**: không phân biệt trực quan độ tin cậy của card (không dim·không màu cảnh báo).
> Nếu chỉ trước tín hiệu nguy hiểm thì tương đương tiết lộ đáp án, game mất ý nghĩa.

**Trọng số card**

| Card | Điểm | Tính chất |
|---|---|---|
| Công khai toàn bộ thành phần | 33 | Tin cậy |
| Test sử dụng thực tế | 33 | Tin cậy |
| Lưu ý khi sử dụng | 30 | Tin cậy |
| Hướng dẫn theo loại da | 28 | Tin cậy |
| Review mua hàng thực tế | 25 | Tin cậy |
| Top 1 doanh số | 12 | Tín hiệu yếu |
| Người nổi tiếng đề xuất | 8 | Tín hiệu yếu |
| Tuyên bố hiệu quả quá mức | 0 | Nguy hiểm |

```
Care = min(100, tổng điểm 3 card đã chọn + bonus thời gian)
Bonus thời gian: hoàn tất 3 card trong 7 giây thì +4
Hết giờ: chỉ cộng card đã chọn(0~2 card)
```
**Subtype**: dựa trên card điểm cao nhất — thiên thành phần(toàn bộ thành phần/lưu ý) / thiên thông tin chuyên môn(test sử dụng/loại da) / thiên phổ biến xã hội(doanh số/người nổi tiếng) / thiên niềm tin thương hiệu(review+mixed)

### CORE 4 — NEXT BEAUTY WAVE (trục: Trend)

**Nội dung**: 6 style card — Glass Skin, Soft Matte, Natural Peach, Bold Color, Minimal Skin, Y2K Beauty. Mỗi card có visual + mô tả một dòng.

**Luồng**: Xuất hiện từng card, swipe 3 hướng hoặc chọn bằng nút phía dưới.

| Hướng | Label (ko / en / vi) | Điểm |
|---|---|---|
| ← | 관심 없어요 / Not for me / Không hợp tôi | 2 |
| ↑ | 다음에 해볼래요 / I'll try next / Sẽ thử sau | 16 |
| → | 지금 좋아요 / Love it now / Thích ngay | 12 |

```
Trend = round( Σđiểm / 96 × 100 )   // phạm vi 12~100
```

> **Nguyên tắc label**: ý nghĩa của hướng phải truyền đạt được chỉ bằng nội dung text (không dùng viết tắt tiếng Anh `NEXT`·`LOVE NOW`
> vì dễ gây nhầm giữa "xu hướng tiếp theo" và "sở thích hiện tại").
> Hiển thị lặp lại mapping 3 hướng quanh card(trái·phải·trên) và ở các nút phía dưới.
**Subtype**: dẫn đầu xu hướng(NEXT ≥ 3) / phong cách thử nghiệm(Bold Color·Y2K có ít nhất 1 LOVE/NEXT) / sở thích ổn định(NOT ME ≥ 3) / đồng cảm đại chúng(còn lại)

**Hiệu ứng kết quả**: "Bạn đã phát hiện trước xu hướng chỉ {p}% người tham gia lựa chọn" — so với phân bố bình chọn hôm nay theo từng card (server).

### CORE 5 — HANOI BEAUTY WEATHER LAB (trục: Local Fit)

**Luồng**: Hiển thị ngẫu nhiên 1 tình huống → trong 5 cặp thuộc tính **VS**, chọn mỗi cặp một bên → [Hoàn tất] → animation gauge mức độ phù hợp.

> **Nguyên tắc hiển thị**: bố trí trái/phải + badge `VS` ở giữa + container theo cặp để thể hiện rõ hai thuộc tính là một cặp.
> (Nếu trông như danh sách 10 lựa chọn thì cấu trúc đối đầu sẽ không được truyền đạt)

**5 cặp thuộc tính**: ①texture nhẹ/texture rich ②matte/glow ③độ bền/thoải mái ④dưỡng ẩm mạnh/thấm nhanh ⑤portable/dung tích lớn

**Bảng kết hợp tối ưu theo tình huống** (○=trái, ●=phải)

| Tình huống | ① | ② | ③ | ④ | ⑤ |
|---|---|---|---|---|---|
| 34°C độ ẩm cao + đi xe máy 30 phút + hẹn trong nhà buổi chiều | Nhẹ | Matte | Bền | Thấm nhanh | Portable |
| Đường đi làm trời mưa | Nhẹ | Matte | Bền | Thấm nhanh | Portable |
| Hẹn hò ngoài trời | Nhẹ | Glow | Bền | Thấm nhanh | Portable |
| Ở trong điều hòa lâu | Rich | Glow | Thoải mái | Dưỡng ẩm mạnh | Dung tích lớn |
| Du lịch cuối tuần | Nhẹ | Matte | Bền | Thấm nhanh | Portable |
| Tiệc tối | Rich | Glow | Bền | Dưỡng ẩm mạnh | Portable |

```
Số lượng khớp → điểm: 5→100 / 4→86 / 3→70 / 2→55 / 1→42 / 0→30
Local Fit = điểm tương ứng
```
**Subtype**: khớp ≥ 4 → thích nghi thời tiết / ưu tiên lựa chọn nhóm 'độ bền' → coi trọng độ bền / ưu tiên 'thoải mái·dưỡng ẩm' → coi trọng thoải mái / 'portable' + nhẹ → coi trọng tính di động

### CORE 6 — REVIEW DETECTIVE (trục: Trust)

**Nội dung**: 3 review card. Mỗi card có **2 kính lúp manh mối** (tap để phóng to: chi tiết rating, loại da, số lượt thích, thời gian sử dụng...).

| Review | Nội dung | Tín hiệu |
|---|---|---|
| A | "Tuyệt đối luôn! Nhất định phải mua!" ★5 | Rating cao, không có trải nghiệm cụ thể |
| B | "Da hỗn hợp. Ban đầu hơi dính nhưng sau một tuần giảm căng da" ★4 + ảnh sử dụng | Trải nghiệm cụ thể |
| C | "Mua vì nổi trên SNS" ♥2.4k | Phổ biến, thiếu thông tin |

```
base: B = 92 | A = 48 | C = 42
Bonus manh mối: trước khi chọn, nếu xem ít nhất 2 kính lúp thì +8 (tối đa 100)
Trust = min(100, base + bonus)
```
**Subtype**: B→coi trọng thông tin chi tiết / B+xem manh mối ảnh→coi trọng ảnh·video / A→coi trọng rating / C→coi trọng độ phổ biến

**Hiệu ứng kết quả**: "{p}% người tham gia cũng tin tưởng cùng review này"

---

## 4. Xác định persona

### 4.1 Quy tắc xác định

1. Chọn **2 trục cao nhất** trong 6 trục.
2. Nếu bằng điểm thì ưu tiên: `Care > Trust > Repick > LocalFit > Value > Trend` (phản ánh định hướng thương hiệu ưu tiên tin cậy·an toàn, đồng thời đảm bảo tính xác định và tái lập)
3. Xác định persona theo bảng 15 tổ hợp dưới đây.

### 4.2 Bảng mapping tổ hợp (đủ 15 tổ hợp)

| 2 trục cao nhất | Persona |
|---|---|
| Repick + Care | **Loyal Glow Keeper** |
| Repick + Trust | Loyal Glow Keeper |
| Value + Trust | **Smart Beauty Curator** |
| Repick + Value | Smart Beauty Curator |
| Trend + LocalFit | **Trend Muse** |
| Value + Trend | Trend Muse |
| Trend + Trust | Trend Muse |
| LocalFit + Value | **Local Beauty Expert** |
| Repick + LocalFit | Local Beauty Expert |
| LocalFit + Trust | Local Beauty Expert |
| Care + Trust | **Trust Guardian** |
| Value + Care | Trust Guardian |
| Care + LocalFit | Trust Guardian |
| Trend + Repick | **Beauty Explorer** |
| Care + Trend | Beauty Explorer |

### 4.3 Persona profile (nguồn cho màn kết quả·style ảnh)

| Persona | 3 keyword | Mô tả (dựa trên bản ko) | Màu Primary / Secondary | Mood |
|---|---|---|---|---|
| Loyal Glow Keeper | #nhìnxa #bềnbỉ #tincậy | Người nhận ra những sản phẩm có thể mang lại sự hài lòng lâu dài | Warm Gold / Soft Ivory | Calm & Warm |
| Smart Beauty Curator | #sosánhphântích #đángtiền #kiểmchứng | Người lựa chọn sau khi so sánh và kiểm chứng kỹ lưỡng | Sapphire Blue / Silver | Sharp & Clean |
| Trend Muse | #trendsetter #cảmnhận #playful | Người phát hiện trước những làn sóng làm đẹp mới | Coral Pink / Electric Violet | Confident & Playful |
| Local Beauty Expert | #thựctế #lifeFit #thôngminh | Người biết loại beauty phù hợp chính xác với một ngày của mình | Fresh Green / Sunlight Yellow | Natural & Easy |
| Trust Guardian | #kiểmtrathànhphần #thậntrọng #yêntâm | Người kiểm tra kỹ thông tin và trải nghiệm | Aqua Mint / Pearl White | Pure & Secure |
| Beauty Explorer | #tòmò #thửthách #lốiđiriêng | Người khám phá vừa tìm kiếm sự mới mẻ vừa duy trì lâu dài | Sunset Orange / Deep Teal | Bold & Free |

### 4.4 Cấu trúc ảnh kết quả (đặc tả ghép template Phase A)

- Canvas: 1080×1920 (master 9:16) → dẫn xuất 4:5(1080×1350)·vuông
- Layer: ① nền gradient persona(Primary→Secondary) ② ảnh người dùng(mask ellipse + glow ring) ③ phần trang trí theo trục(motif của 2 trục cao nhất: ribbon/hình học/shield/neon/silhouette Hà Nội/ánh sao) ④ logo AEPICK ⑤ typography tên persona ⑥ radar 6 trục mini ⑦ nickname ⑧ `#AEPICKBeautyDNA` + địa điểm·ngày popup
- Khi áp dụng Phase B(API thật), thay ①~③ bằng ảnh tạo sinh, còn ④~⑧ giữ nguyên cách ghép

---

## 5. Logic đề xuất thương hiệu·sản phẩm

v1 có hai bộ code constant riêng(cho thương hiệu·cho sản phẩm), còn v2 hợp nhất thành **một DB catalog do vận hành viên quản lý trực tiếp trong admin**.

### Dữ liệu
- `brands` — mỗi thương hiệu có `personaTags`(DNA mục tiêu đề xuất) và `axisAffinity`(độ mạnh theo 6 trục, 0~1)
- `brand_products` — sản phẩm thuộc thương hiệu (không phân biệt SKU)
- Giá trị khởi tạo: seed **10 thương hiệu · 30 sản phẩm** giả lập. Chỉ chạy một lần khi bảng thương hiệu đang trống
  (để thương hiệu mà vận hành viên xóa không tự sống lại sau restart)

### Công thức đề xuất
```
điểm = (khớp persona tag ? 10 : 0)
     + axisAffinity[trục top1] × 1.4
     + axisAffinity[trục top2] × 1.0
→ sắp xếp giảm dần chọn 4 thương hiệu, tối đa 5 sản phẩm đại diện từ các thương hiệu đó
```

### Nguyên tắc cố định kết quả
Kết quả đề xuất được **chốt tại thời điểm trải nghiệm và lưu vào `results.product_ids`**.
Sau đó dù vận hành viên chỉnh catalog thì **kết quả đã phát cho khách vẫn không thay đổi.**

### Quan hệ với bình chọn
- **Đề xuất**: 4 thương hiệu phù hợp DNA cá nhân (khác nhau theo từng khách)
- **Bình chọn**: sản phẩm của **toàn bộ** thương hiệu đang vận hành popup (giống nhau cho mọi khách)

---

## 6. Nguyên tắc nội dung đa ngôn ngữ

- Mọi text hiển thị trên kiosk được quản lý bằng i18n key (`vi` mặc định, `en`, `ko`) — xem cấu trúc key trong [tài liệu 03](VN_03_API_데이터명세.md)
- Tính nhất quán cây key của 3 ngôn ngữ được **ép bằng automated test**
- Tên persona·game giữ nguyên proper name tiếng Anh, chỉ dịch phần mô tả
- Nội dung vi hiện là machine translation và có `_note: "[감수 필요]"` — **cần kiểm duyệt bản địa**

### Những phần vẫn chưa đa ngôn ngữ ⚠️

| Đối tượng | Hiện trạng | Cần xử lý |
|---|---|---|
| 6 ảnh bridge · 1 ảnh kết thúc | Nội dung tiếng Hàn được đóng sẵn trong ảnh | Tạo ảnh theo ngôn ngữ hoặc tách text |
| Trang bình chọn · hoàn tất | Hardcode tiếng Hàn trong server HTML | Áp dụng i18n |
| Trang ghép đôi mock | Hardcode tiếng Hàn | Sẽ được thay khi tích hợp app thực tế nên không cần |

Vì khách Việt Nam là đối tượng chính nên **hai hạng mục đầu phải được xử lý trước khi vận hành tại hiện trường.**
