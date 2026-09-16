# AEPICK BEAUTY DNA — Hướng dẫn FE TEST Gallery

> Công cụ xem trước toàn bộ màn hình (PAD + trang mobile + trang vận hành) **không cần chạy
> backend/Postgres**. Dùng khi sửa giao diện/copy và muốn xem kết quả ngay, không cần
> `START-DEMO.bat` hay database thật.

---

## 1. Chạy thử

Double-click **`START-FE-TEST.bat`** ở gốc repo (lần đầu tự `npm install`, mất 3-5 phút).

Hoặc bằng lệnh:
```bash
npm run fe:test
```

Trình duyệt tự mở `http://localhost:5180/test.html` — gallery liệt kê toàn bộ màn hình theo 6 nhóm
(luồng chính, 6 game, bridge, overlay, trang mobile, trang vận hành), có thể xem từng màn hoặc
xem lưới tất cả cùng lúc.

## 2. Sửa giao diện

1. Ở gallery, chọn màn hình muốn sửa.
2. Nhìn góc dưới cùng — dòng **"SỬA FILE"** cho biết đúng file nguồn (VD: `apps/kiosk/src/screens/flow.tsx`).
3. Mở file đó bằng editor (VS Code...), sửa, **lưu (Ctrl+S)**.
4. Trình duyệt tự refresh ngay — không cần thao tác gì thêm.

**Đây là file thật** — không có bản sao riêng cho gallery. Sửa xong, `START-DEMO.bat` /
`START-TUNNEL.bat` chạy bản thật với cùng nội dung đã sửa, không cần đồng bộ hay copy gì thêm.

Không có nút "Lưu" trên giao diện web — trình duyệt chỉ xem, việc sửa luôn phải làm ở editor.

## 3. Các nút trên thanh công cụ

| Nút/control | Chức năng |
|---|---|
| **1 màn hình / Xem tất cả** | Chuyển giữa xem 1 màn phóng to và xem lưới toàn bộ |
| **NGÔN NGỮ** (VI/EN/KO) | Đổi ngôn ngữ hiển thị của màn đang xem |
| **NỀN** (dropdown) | Xem thử tông màu nền khác — không đổi code, chỉ preview |
| **⧉ Copy CSS** | Copy đoạn CSS của tông màu đang xem vào clipboard, để **tự dán tay** vào `styles.css` nếu muốn áp dụng thật |
| **ZOOM** | Phóng to/nhỏ khung xem (chỉ ở chế độ 1 màn hình) |
| **↻ Phát lại** | Reset lại trạng thái màn hình đang xem |
| **Tự chuyển màn** | Bật = mô phỏng cả luồng như bản thật (màn tự nhảy tiếp theo); Tắt = đứng yên 1 màn để sửa giao diện |

## 4. Phạm vi — không đụng gì tới bản thật

- Chỉ chạy khi gọi đúng lệnh `npm run fe:test` hoặc build với cờ `FE_TEST=1`
  (`npm run fe:build` → xuất ra `apps/kiosk/dist-fe-test/`, thư mục riêng).
- `npm run demo:build` / `START-DEMO.bat` / `START-TUNNEL.bat` **hoàn toàn bỏ qua** `test.html`
  và `fe-test-pages.ts` — build bản thật (`apps/kiosk/dist/`) không chứa gì của gallery.
- Không route nào trong `server/` bị đổi hành vi — gallery chỉ *đọc* các hàm dựng HTML có sẵn
  (`server/src/pages.ts`, `votePages.ts`, `pairingRoutes.ts`, `catalogRoutes.ts`), không sửa
  hay ảnh hưởng server thật đang chạy.

→ Vì vậy **không bắt buộc phải xóa sau khi dùng xong** — để nguyên không tốn chi phí gì, không
ai vô tình bấm nhầm vào lúc chạy demo thật.

## 5. Muốn xóa hoặc tắt sau này

### Cách 1 — Xóa hẳn (khuyến nghị, 1 lệnh)

Toàn bộ tool này nằm gọn trong **1 commit riêng**, tách biệt khỏi phần thiết kế màn hình:

```bash
git revert ca2facf
```

Lệnh này tự gỡ đúng 12 file thuộc về tool (`START-FE-TEST.bat`, `apps/kiosk/fe-test-pages.ts`,
`apps/kiosk/test.html`, cả thư mục `apps/kiosk/src/test/`) và phần đã thêm vào
`apps/kiosk/vite.config.ts` + `package.json` (gốc) — **không đụng** tới các màn hình
(`flow.tsx`, `games.tsx`, `styles.css`...) hay phần backend Postgres/export Excel.

### Cách 2 — Tắt tạm mà không xóa code

Không cần comment tay — chỉ cần **không gọi** `npm run fe:test` / không double-click
`START-FE-TEST.bat`. Tool này không tự chạy cùng `START-DEMO.bat`/`START-TUNNEL.bat` nên
"tắt" mặc định sẵn, không cần làm gì thêm.

## 6. Thông tin commit (nhánh `feature/supabase-migration`, chưa push)

| Commit | Nội dung | Có nên revert khi gỡ tool không? |
|---|---|---|
| `38fac5e` | Merge thiết kế màn hình mới của DucAnh (consent, 6 game, trang mobile, trang admin) | **Không** — đây là thiết kế, không thuộc về tool |
| `98c36ce` | Thêm dependency font `@fontsource/be-vietnam-pro` còn thiếu | **Không** — font dùng cho bản thật |
| `ca2facf` | Tool FE TEST Gallery (`START-FE-TEST.bat` + `test.html` + `fe-test-pages.ts` + `src/test/*`) | **Có** — `git revert ca2facf` khi không cần nữa |

Xem chi tiết từng commit:
```bash
git show 38fac5e --stat
git show 98c36ce --stat
git show ca2facf --stat
```
