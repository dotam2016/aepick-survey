# AEPICK BEAUTY DNA v2 — Hướng dẫn dành cho Designer

> Tài liệu này tổng hợp cách thay ảnh và file nào được dùng ở màn hình nào.
> Được thiết kế để có thể **tự thay ảnh mà không cần developer hỗ trợ**.

---

## 0. Tóm tắt trong 3 dòng

1. Toàn bộ ảnh nằm trong folder `apps/kiosk/public/assets/ui/`.
2. Chỉ cần **ghi đè ảnh mới với đúng tên file cũ** là thay đổi mà không cần sửa code.
3. Logo thương hiệu và ảnh sản phẩm không nhập bằng file cố định mà **điền đường dẫn trong màn hình admin (`/admin/catalog`)**.

---

## 1. Những điều cần biết trước khi làm

### Tỷ lệ màn hình

Kiosk được thiết kế theo **tablet Android ở portrait mode**.
Thiết kế theo kích thước **1200 × 1800 (2:3)** sẽ gần với màn hình thực tế nhất.

### Định dạng file

| Loại | Định dạng | Lý do |
|---|---|---|
| Icon · decoration · product cut | **PNG (nền trong suốt)** | Được đặt lên trên background nên bắt buộc trong suốt |
| Ảnh full-screen (bridge · kết thúc) | **JPG** | Phủ kín màn hình, không cần transparency và dung lượng nhỏ hơn |

### Dung lượng

Khuyến nghị **dưới 250KB mỗi ảnh**.
File lớn nhất hiện tại là `photocards.png` 820KB, đây là nguyên nhân làm first load chậm trên tablet.

### Độ phân giải

Chỉ cần làm ở **2× kích thước hiển thị** là đủ cho màn hình độ phân giải cao.
Ví dụ: icon hiển thị 60px → tạo 120×120.

---

## 2. Cách thay ảnh

```
1. Mở folder apps/kiosk/public/assets/ui/
2. Dùng ảnh mới có "đúng cùng tên" với file muốn thay để ghi đè
3. Báo developer "hãy build lại"  (hoặc chạy lại START-DEMO.bat)
```

> **Nếu đổi tên file, ảnh sẽ biến mất.** Code tìm ảnh theo tên file.
> Nếu bắt buộc phải đổi tên thì cần báo developer.

Đuôi file cũng phải giữ nguyên. Nếu đổi `bridge-repick.jpg` sang PNG thì cần sửa code.

---

## 3. Asset manifest — file nào dùng ở màn hình nào?

### 3-1. Dùng chung toàn bộ màn hình

| File | Nơi sử dụng | Kích thước hiện tại | Ghi chú |
|---|---|---|---|
| `logo.png` | Header trên mọi màn hình | 315×100 | Wordmark ngang |
| `logo-sub.png` | Wordmark ở màn chờ | — | Logo lớn |

### 3-2. Màn chờ (trước khi khách quét QR)

| File | Nơi sử dụng | Kích thước hiện tại |
|---|---|---|
| `photocards.png` | Card hình ở phía trên | 717×505 |
| `icon-people.png` | Icon "người tham gia hôm nay" | — |
| `icon-fire.png` | Icon "DNA phổ biến" | — |
| `step-photo.png` | Hướng dẫn 3 bước ① **Scan** | 106×111 |
| `step-picks.png` | Hướng dẫn 3 bước ② **6 Picks** | — |
| `step-ai.png` | Hướng dẫn 3 bước ③ **Brands** | — |

> **Lưu ý — tên file và nội dung hiện không còn khớp.**
> Ở v1, 3 bước là `chụp ảnh → 6 Picks → kết quả AI`.
> Ở v2 đã đổi thành `quét QR → 6 Picks → đề xuất thương hiệu`,
> nhưng **để tiện thay ảnh, tên file vẫn giữ nguyên**.
> Hãy đặt hình **QR/scan** vào `step-photo.png`, và hình **brand/shopping bag** vào `step-ai.png`.

Ngoài ra card màn chờ (`photocards.png`) vẫn là ví dụ ảnh kết quả AI của v1.
v2 không còn ảnh AI nên cần **thay bằng hình gợi liên tưởng đến kết quả đề xuất thương hiệu**.

### 3-3. Chọn ngôn ngữ

| File | Nơi sử dụng |
|---|---|
| `flag-vn.png` `flag-en.png` `flag-kr.png` | Icon quốc kỳ (106×112) |

### 3-4. Decoration (dùng chung nhiều màn hình)

Các heart·gem nổi trên background. Phải là PNG nền trong suốt.

```
heart-glossy.png   heart-big.png    heart-small.png
heart-diamond.png  heart-badge.png  heart-gem.png
diamond.png        pearl.png        ruby.png
gem-pink.png  gem-blue.png  gem-gold.png
gem-green.png gem-purple.png gem-teal.png
```

`ruby.png` / `pearl.png` dùng làm chỉ báo tiến độ(đang ở bước thứ mấy trong 6 bước).
**Trạng thái bật = ruby, trạng thái tắt = pearl**, vì vậy hai ảnh phải cùng kích thước·cùng hình dạng để nhìn tự nhiên.

### 3-5. Màn hình game

| Game | File | Mục đích |
|---|---|---|
| CORE1 mua lại | `product-serum.png` `product-lotion.png` `product-cream.png` | Product cut để drag (315×348) |
| CORE2 giá trị | `coin.png` | Coin để phân bổ |
| CORE3 thành phần | `sh-*.png` 8 loại | Icon card (hiển thị 38×38) |
| CORE4 xu hướng | `trend-*.png` 6 loại | **Background toàn card** khi swipe |
| CORE5 local fit | `scenario-rainy.png` `weather-rain.png` `fit-heart.png` | Illustration tình huống |
| CORE6 trust | `shield-hero.png` | Illustration phía trên |
| Icon thuộc tính | `attr-*.png` 11 loại | **Dùng làm mask** — xem giải thích dưới |

**8 file `sh-*.png`** (icon card CORE3)
```
sh-fullIngredients  sh-realTest    sh-skinType    sh-realReviews
sh-bestSeller       sh-celebrity   sh-overclaim   sh-caution
```

**6 file `trend-*.png`** (background card CORE4 — cảm giác ảnh người/sản phẩm)
```
trend-glassSkin  trend-y2k  trend-boldColor
trend-softMatte  trend-naturalPeach  trend-minimalSkin
```

**11 file `attr-*.png` là trường hợp đặc biệt.**
Các file này chỉ được dùng làm **silhouette(mask)**. Màu được code áp vào.
Vì vậy hãy làm dạng **silhouette đơn sắc**. Dù thêm màu hay gradient thì cũng bị bỏ qua.
```
attr-glow  attr-deepMoist  attr-fastAbsorb  attr-light  attr-rich
attr-matte  attr-lasting  attr-comfort  attr-portable  attr-jumbo
```

### 3-6. Bridge giữa game (thông điệp thương hiệu)

Sau mỗi game, ảnh sẽ xuất hiện **full-screen trong 3 giây**.

| File | Thứ tự |
|---|---|
| `bridge-repick.jpg` | Sau game1 |
| `bridge-value.jpg` | Sau game2 |
| `bridge-care.jpg` | Sau game3 |
| `bridge-trend.jpg` | Sau game4 |
| `bridge-localFit.jpg` | Sau game5 |
| `bridge-trust.jpg` | Sau game6 |

- Kích thước hiện tại **1200×1799**
- Hiển thị bằng `contain` → **không bị crop, nhưng nếu khác tỷ lệ sẽ có khoảng trống trên/dưới**
- **Text được vẽ trực tiếp trong ảnh.** Muốn đổi nội dung phải tạo lại ảnh
- ⚠️ **Hiện chỉ có tiếng Hàn.** Khách Việt/Anh vẫn thấy tiếng Hàn (xem mục 5)

### 3-7. Màn hình phân tích

| File | Mục đích |
|---|---|
| `dna-orb.png` | Khối cầu xoay ở giữa (368×393) |
| `dna-gem-1.png` ~ `dna-gem-6.png` | 6 gem quay theo quỹ đạo |
| `dna-helix.png` | DNA helix |

### 3-8. Màn hình kết quả

| File | Mục đích |
|---|---|
| `axis-repick.png` `axis-value.png` `axis-care.png` `axis-trend.png` `axis-localFit.png` `axis-trust.png` | Icon tại các đỉnh radar chart lục giác (61×57) |

Do hiển thị nhỏ nên hãy thiết kế **hình dạng đơn giản**.

### 3-9. Màn hình kết thúc

| File | Mục đích |
|---|---|
| `end-final.jpg` | Full-screen sau khi kết thúc trải nghiệm (1200×1799) |

Tương tự bridge, **text nằm trực tiếp trong ảnh và hiện chỉ có tiếng Hàn**.

### 3-10. File tham khảo

`_contact-sheet.png` là sheet preview dùng trong quá trình làm việc. Không sử dụng trong màn hình nên có thể bỏ qua.

---

## 4. Logo thương hiệu và ảnh sản phẩm — nhập trong admin

Hai nhóm này không dùng file path cố định trong code mà **nhập đường dẫn trong màn hình quản lý**.
Mục đích là để khi thương hiệu thay đổi trong thời gian vận hành vẫn có thể thay mà không cần developer.

### Quy trình

```
1. Đặt ảnh vào folder apps/kiosk/public/assets/brands/
   (nếu chưa có folder thì tạo mới)

2. Mở  http://<địa chỉ>/admin/catalog  trên browser
   → nếu yêu cầu admin key thì nhận từ người vận hành

3. Nhập vào ô "đường dẫn ảnh logo" của thương hiệu
      /assets/brands/purelab-logo.png
   Ảnh sản phẩm cũng nhập tương tự

4. Nhấn [Lưu] là phản ánh ngay (không cần build)
```

### Kích thước khuyến nghị

| Hạng mục | Kích thước | Định dạng | Ghi chú |
|---|---|---|---|
| Logo thương hiệu | 200×200 | PNG trong suốt | Hình vuông. Khi hiển thị được crop thành rounded square |
| Ảnh sản phẩm | 400×400 | PNG hoặc JPG | Hình vuông. Hiển thị nhỏ trong màn bình chọn |

Nếu không có logo thì **emoji được dùng thay thế**. Trong trường hợp gấp có thể vận hành chỉ với emoji.

---

## 5. Hai điều bắt buộc phải biết ở trạng thái hiện tại

### (1) Màn bridge·kết thúc chỉ có tiếng Hàn

7 ảnh (`bridge-*.jpg` 6 ảnh + `end-final.jpg`) có **text nằm trực tiếp trong hình** và hiện **chỉ có tiếng Hàn**.

Popup Hà Nội chủ yếu dành cho khách Việt Nam nên **cần bản tiếng Việt**.

Có hai cách xử lý:

| Cách | Khối lượng | Kết quả |
|---|---|---|
| **A. Tạo ảnh theo từng ngôn ngữ** | 7 ảnh × 3 ngôn ngữ = **21 ảnh** | Giữ nguyên cấu trúc hiện tại. Cần một ít dev work |
| **B. Bỏ text khỏi ảnh, chỉ giữ background** | 7 ảnh | Text được code overlay. Chỉ cần đổi bản dịch, dễ bảo trì |

**Khuyến nghị B.** Khi sửa nội dung không cần thông qua designer, và khi thêm ngôn ngữ cũng không cần tạo lại ảnh.
Tuy nhiên cần thống nhất vị trí·cỡ chữ với developer.

### (2) Icon 3 bước ở màn chờ vẫn là hình của kế hoạch cũ

Như đã ghi ở 3-2, `step-photo.png`(camera) và `step-ai.png`(AI) mô tả **chức năng không còn tồn tại trong v2**.
Cần thay bằng **QR scan** và **đề xuất thương hiệu**.

---

## 6. Kiểm tra sau khi thay

```
1. Chạy START-DEMO.bat
2. Mở http://localhost:8787/ trên browser
3. Kiểm tra lần lượt từ màn chờ
```

Nếu ảnh có vẻ chưa đổi, thử **hard refresh(Ctrl+Shift+R)**. Có thể browser cache vẫn còn.

Nếu vẫn không thay đổi, hãy báo developer **"build lại giúp tôi"**.

---

## 7. Checklist

Sau khi thay xong, hãy kiểm tra các mục sau.

- [ ] Giữ nguyên tên file và extension
- [ ] Icon·decoration là **PNG nền trong suốt**
- [ ] `attr-*.png` được làm dạng **silhouette đơn sắc**
- [ ] Mỗi ảnh dưới 250KB
- [ ] Đã thống nhất với developer **cách xử lý ngôn ngữ** cho ảnh bridge·kết thúc
- [ ] Đã thay icon 3 bước màn chờ thành **QR / 6 Picks / thương hiệu**
- [ ] `ruby.png` và `pearl.png` có cùng kích thước·hình dạng
- [ ] Đã kiểm tra trực tiếp trên tablet thật ở portrait mode
