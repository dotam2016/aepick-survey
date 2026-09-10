# AEPICK BEAUTY DNA v2 — Hướng dẫn demo

> Phiên bản 2.0 · 2026-08-19
> Cấu hình: **Laptop(server) + tablet(PAD) + 2 điện thoại** · sử dụng Wi-Fi tại hiện trường

---

## 0. Điểm khác so với v1 — vui lòng đọc trước

### Cần **2 điện thoại**

v2 chỉ bắt đầu trải nghiệm khi **quét QR**. Vì vậy điện thoại được dùng hai lần trong demo.

| Thời điểm | Mục đích |
|---|---|
| **Bắt đầu** trải nghiệm | Quét QR trên PAD để liên kết tài khoản app |
| **Kết thúc** trải nghiệm | Quét QR kết quả để xem trang kết quả·bình chọn |

Một điện thoại cũng được, nhưng khi trình diễn trước người xem thì **tách máy bắt đầu và máy kết quả** sẽ giúp luồng không bị gián đoạn.

### Không cần quyền camera

Đã bỏ chụp khuôn mặt. **Không cần cài quyền camera cho tablet.**

Tuy nhiên `START-DEMO.bat` vẫn chạy bằng HTTPS (nút share trên trang kết quả cần secure context).
Vì vậy **cảnh báo certificate vẫn xuất hiện.** Điện thoại khách cũng sẽ thấy cảnh báo,
nên nếu muốn demo mượt trước khán giả thì nên dùng **tunnel ở mục 8** (certificate hợp lệ, không cảnh báo).

### Không còn cấu hình ảnh AI

Các setting `AI_PROVIDER` / `GEMINI_API_KEY` của v1 **không còn tác dụng**.
Đã xóa khỏi script chạy.

### Nếu có nhiều PAD phải chỉ định device ID

Các PAD dùng cùng ID sẽ làm code pairing của nhau vô hiệu, khiến **quét QR nhưng trải nghiệm không bắt đầu.**

```
Chỉ cần làm một lần trên mỗi PAD:  http://<địa chỉ>:8787/?device=PAD-01
```

Sau đó mở không có parameter vẫn giữ nguyên. **Nếu demo chỉ dùng 1 PAD thì không cần quan tâm.**

---

## 1. Cách chạy dễ nhất — double click

| File | Chức năng |
|---|---|
| **`START-DEMO.bat`** | Kiểm tra Node → (lần đầu) cài package → build → chạy HTTPS server |
| **`START-TUNNEL.bat`** | Tương tự nhưng **chạy bằng public URL(tunnel)** — xem mục 8 |
| **`SEED-DATA.bat`** | Điền thống kê màn chờ(1) / xóa(2) |

- Nhập địa chỉ **`KIOSK (TABLET)`** hiển thị trong cửa sổ vào browser tablet
- Kết thúc: `Ctrl + C` trong cửa sổ đó hoặc đóng cửa sổ
- Đóng cửa sổ là server cũng tắt, vì vậy **trong lúc demo hãy để cửa sổ mở**

Nếu quen terminal thì tương đương `npm run demo`.

---

## 2. Chuẩn bị trước khi đi (bắt buộc rehearsal 1 lần tại văn phòng)

```bash
npm install          # chỉ lần đầu
npm run demo         # build + chạy HTTPS server
```

Sau khi chạy, console hiển thị địa chỉ truy cập.

```
  KIOSK  (this PC)   https://localhost:8787/
  KIOSK  (TABLET)    https://10.100.180.111:8787/     <-- nhập địa chỉ này trên tablet
  ADMIN  dashboard   https://localhost:8787/admin      (key: aepick-admin)
  ADMIN  catalog     https://localhost:8787/admin/catalog
```

### Checklist

- [ ] Mở `https://localhost:8787/` trên browser laptop → **chạy toàn bộ journey 1 lần**
- [ ] Trên tablet truy cập LAN URL → cảnh báo certificate [Nâng cao] → [Tiếp tục] chấp nhận 1 lần
- [ ] **Dùng điện thoại quét QR trên PAD** để pairing → xác nhận PAD tự chuyển màn hình
- [ ] Hoàn tất trải nghiệm → **quét QR kết quả** → trang kết quả → **chọn 3 sản phẩm bình chọn** → màn hoàn tất
- [ ] Ở màn hoàn tất **nhấn giữ góc dưới bên phải 1.2 giây** → nhân viên xác nhận → nhập PIN → hiển thị số lần quay lại
- [ ] Mở `/admin/catalog`, đổi thử tên một thương hiệu và xác nhận phản ánh vào kết quả
- [ ] Dùng `npm run demo:seed` để điền thống kê màn chờ
- [ ] **Tắt sleep/screen lock của laptop**, tắt auto lock của tablet
- [ ] **Tạm dừng Dropbox·OneDrive sync** (file lock có thể làm build thất bại)

> Staff PIN mặc định là `1234`. Có thể đổi tại `set STAFF_PIN=1234` trong `START-DEMO.bat`.

---

## 3. Thứ tự setup tại hiện trường (10 phút)

1. Kết nối laptop·tablet·điện thoại vào **cùng Wi-Fi**
2. Chạy `START-DEMO.bat` trên laptop → kiểm tra **địa chỉ dành cho tablet** trong console
3. Chạy `SEED-DATA.bat` → nhập `1` (điền thống kê màn chờ)
4. Mở địa chỉ trên browser tablet → chấp nhận cảnh báo certificate → **full-screen mode**
   - Android Chrome: ⋮ → Add to Home screen → chạy như app
   - iPad Safari: Share → Add to Home Screen
5. Nếu **QR xuất hiện trên màn chờ** là sẵn sàng
6. (Nhiều PAD) Mở lần lượt mỗi thiết bị với `?device=PAD-01`, `?device=PAD-02` …

> **Nếu IP thay đổi** (ví dụ reconnect Wi-Fi), restart server và nhập lại địa chỉ tablet.

---

## 4. Kịch bản demo (khoảng 5 phút)

| Thứ tự | Màn hình | Điểm cần nói |
|---|---|---|
| 1 | Màn chờ | "Hôm nay có N người tham gia, DNA phổ biến là …" — thống kê real-time |
| 2 | **Quét QR** | **Dùng điện thoại quét trực tiếp để cho thấy.** PAD chuyển ngay sau khi quét là điểm gây ấn tượng |
| 3 | Chọn ngôn ngữ | Tiếng Việt mặc định · 3 ngôn ngữ |
| 4 | 6 game | Mỗi game 30 giây. **CORE1 drag**, **CORE3 timer 10 giây** có hiệu ứng demo tốt |
| 4-1 | Thông điệp thương hiệu | Tự hiển thị 3 giây sau mỗi game — giải thích "AEPICK lựa chọn theo tiêu chí nào" |
| 5 | Phân tích | Hiệu ứng 3.5 giây |
| 6 | Kết quả DNA | Persona + radar 6 trục + "N% người tham gia" |
| 7 | QR·đề xuất | 4 thương hiệu phù hợp — giải thích đây là **cơ chế dẫn khách tới booth thương hiệu** |
| 8 | **Trang kết quả** | Dùng điện thoại thứ hai quét QR → mở kết quả của mình không cần login |
| 9 | **Bình chọn** | Chọn 3 sản phẩm trong 10 thương hiệu → submit |
| 10 | **Nhân viên xác nhận** | Nhấn giữ góc dưới bên phải → PIN → **số lần quay lại** |
| 11 | Admin | `/admin/catalog` — có thể quản lý thương hiệu trực tiếp tại hiện trường |

**Demo nhanh(2 phút)**: chỉ trình diễn CORE1·CORE3, lướt nhanh các game còn lại → tập trung kết quả·bình chọn·nhân viên xác nhận

### Demo khách quay lại

Pairing **lại cùng account ID** sẽ tăng số lượt ghé.
Muốn hiển thị "Khách này đang ở lần ghé thứ 3" thì lặp lại 3 lần với cùng ID.

> Tuy nhiên **bình chọn chỉ được 1 lần/tài khoản**. Muốn demo bình chọn lại phải pairing bằng **ID khác**.

---

## 5. Troubleshooting tại hiện trường

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| **Quét QR nhưng PAD không chuyển** | Điện thoại khác network | Kiểm tra cùng Wi-Fi → không được thì dùng **mục 8 tunnel** |
| | QR hết hạn(3 phút) | Quét lại **QR mới** trên màn chờ |
| | Nhiều PAD dùng cùng device ID | Chỉ định `?device=PAD-01` cho từng PAD (xem mục 0) |
| Điện thoại hiện certificate warning | Self-signed certificate | [Nâng cao] → [Tiếp tục]. Nếu demo trước khán giả nên dùng **mục 8 tunnel** |
| Tablet **không truy cập được** | Khác Wi-Fi / firewall | Kiểm tra cùng mạng → cho phép Node qua firewall → **mục 8 tunnel** |
| Wi-Fi hiện trường chặn giao tiếp giữa thiết bị | AP isolation(guest network) | Dùng **mục 8 tunnel** để bypass |
| **Không bình chọn được** (`already_voted`) | Tài khoản này đã bình chọn | Pairing bằng account ID khác |
| Không mở được staff UI | Chỉ tap ngắn | **Nhấn giữ ít nhất 1.2 giây** |
| PIN không đúng | Khác mặc định | Kiểm tra `set STAFF_PIN=` trong `START-DEMO.bat` |
| Không thấy thương hiệu | Đang tắt hiển thị | Check [Hiển thị] trong `/admin/catalog` |
| Màn hình có vẻ bị đứng | Đang chờ inactivity timeout | Tap màn hình hoặc chọn [Quay lại từ đầu] trong cảnh báo |
| Force reset session | — | Tap **5 lần liên tục góc trên bên trái** → xác nhận |

---

## 6. Dọn dẹp sau demo

```bash
npm run demo:reset     # xóa seed data
```

- **Không thu thập ảnh khuôn mặt ngay từ đầu** (v2 đã xóa chức năng chụp ảnh)
- Account identifier của app chỉ lưu dạng hash, không lưu giá trị gốc
- Trang kết quả tự xóa sau 48 giờ
- Muốn reset toàn bộ demo data, xóa `server/data/aepick.sqlite` rồi restart

> **Lưu ý**: Xóa DB sẽ **xóa luôn catalog thương hiệu·sản phẩm**.
> Khi restart, 10 thương hiệu dummy được seed lại, vì vậy dữ liệu thương hiệu thật đã nhập trong admin sẽ mất.

---

## 7. Cách chuyển sang laptop demo

**Khuyến nghị: copy folder bằng USB hoặc cách tương tự thay vì Dropbox sync**

`node_modules` có hàng chục nghìn file nên Dropbox sync rất chậm, và file có thể bị lock trong lúc sync khiến build fail.

1. **Cần copy**: `apps/`, `server/src/`, `packages/`, `tools/`, `docs/`,
   `START-DEMO.bat`, `START-TUNNEL.bat`, `SEED-DATA.bat`,
   `package.json`, `package-lock.json`, `tsconfig.base.json`
2. **Có thể bỏ**: `node_modules/`, `apps/kiosk/dist/`, `server/data/`
3. Trên laptop demo **cài Node.js LTS(22+)** → double click `START-DEMO.bat`
   (lần đầu sẽ tự `npm install` — **cần Internet, 3~5 phút**)
4. **Hoàn tất bước này ở Hàn Quốc và rehearsal toàn bộ 1 lần**

> ⚠️ **Không copy nguyên `node_modules`.**
> Khi copy từ folder khác, workspace symbolic link có thể **trỏ về absolute path của folder cũ**,
> khiến code đã sửa không được phản ánh. Bắt buộc chạy `npm install` trong folder mới.
> (Đây là lỗi thực tế đã gặp trong quá trình phát triển v2 — [báo cáo kiểm thử E1](VN_04_검증보고서.md))

### Có thể chạy bằng Claude Code không?

Có thể, nhưng **không khuyến nghị dùng làm phương thức chạy demo chính**.

- Mất Internet thì không hoạt động → sự cố mạng tại hiện trường sẽ làm demo không chạy
- Mất hàng chục giây cho command execution/confirmation, gây chờ trước khán giả
- Nếu login/auth bị chặn ở nước ngoài sẽ không có phương án thay thế

**Hãy chạy bằng `START-DEMO.bat`, và chỉ cài Claude Code làm backup để chẩn đoán khi có lỗi.**

---

## 8. Public tunnel (Cloudflare Tunnel) — phương án dự phòng network

### Khi nào dùng

| Tình huống | Tunnel có giải quyết không |
|---|---|
| Wi-Fi sự kiện chặn giao tiếp giữa các thiết bị(AP isolation) | ✅ |
| **Điện thoại chỉ dùng LTE và khác mạng laptop** | ✅ **đặc biệt quan trọng ở v2** — quét QR là bước bắt đầu trải nghiệm |
| Certificate warning gây khó chịu | ✅ certificate hợp lệ nên không cảnh báo |
| Demo real-time cho người xem từ Hàn Quốc | ✅ chỉ cần gửi URL |
| Không có Internet | ❌ tunnel bắt buộc cần Internet |

> **Tunnel quan trọng hơn ở v2 so với v1.** Nếu điện thoại khách không truy cập được server thì trải nghiệm **không thể bắt đầu**.

### Chuẩn bị (chỉ lần đầu)

```bash
winget install --id Cloudflare.cloudflared -e
```

### Chạy

Double click `START-TUNNEL.bat` → mở 2 cửa sổ.

- Cửa sổ **AEPICK - Tunnel Address**: sau khoảng 5 giây hiển thị `https://xxxx.trycloudflare.com`
- Cửa sổ **Demo Server**: server log + **admin key cho lần chạy này**

Nếu dùng terminal: `npm run demo:tunnel` (tunnel chạy ở cửa sổ riêng bằng `cloudflared tunnel --url http://localhost:8787`)

### Cách hoạt động

```
điện thoại/tablet ──HTTPS(certificate hợp lệ)──▶ Cloudflare ──HTTP──▶ laptop :8787
```

- TLS được terminate tại Cloudflare nên local server chạy HTTP
- Server dùng `trustProxy` để tin `X-Forwarded-Proto`, vì vậy **QR pairing và QR kết quả đều tự sinh đúng tunnel domain + https**

### Lưu ý

- **URL thay đổi mỗi lần chạy.** Restart thì phải nhập URL mới trên tablet
- **Ai biết URL cũng có thể truy cập.** Chỉ mở trong thời gian demo và đóng cả 2 cửa sổ khi xong
- Nếu `TUNNEL=1`, admin key được **random mỗi lần chạy** (hiển thị ở dòng `ADMIN` trong server window)
- Trên mạng nội bộ công ty, **hãy kiểm tra security policy trước**. Tunnel có thể bị xem là hành vi "bypass firewall để expose PC nội bộ ra ngoài"
- `trycloudflare.com` miễn phí không có SLA. **Chỉ dùng làm dự phòng, không phải phương án chính**

---

## 9. Checklist đồ cần chuẩn bị

- [ ] Laptop (đã cài Node 22.13+, đã `npm install`)
- [ ] Tablet (khuyến nghị từ 12 inch, portrait mode, tắt auto lock)
- [ ] **2 điện thoại** (một máy cho QR bắt đầu · một máy cho QR kết quả)
- [ ] **Portable Wi-Fi router hoặc laptop hotspot** ← dự phòng khi Wi-Fi hiện trường không ổn định
- [ ] (Khuyến nghị) cài `cloudflared` — dự phòng tunnel ở mục 8
- [ ] Sạc laptop, giá đỡ tablet, ổ cắm kéo dài
- [ ] Dự phòng offline: in tài liệu này hoặc lưu offline

> **Nguyên nhân thất bại phổ biến nhất là network.** v2 bắt đầu bằng quét QR nên
> việc **điện thoại có truy cập được server hay không** quan trọng hơn v1 rất nhiều.
> Chuẩn bị router di động hoặc tunnel sẽ giúp không phụ thuộc trạng thái Wi-Fi tại hiện trường.
