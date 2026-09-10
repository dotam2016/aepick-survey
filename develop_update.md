# i18n cho trang Bình chọn · Hoàn tất · Pairing (mock)

**Ngày:** 2026-08-30
**Trạng thái:** Đã code xong, đã type-check + test tự động, **chưa commit**, **chưa test tay qua trình duyệt**.

## Vấn đề ban đầu

`server/src/votePages.ts` (trang bình chọn `/v/:token` và trang hoàn tất `/v/:token/done`) và
`server/src/pairingRoutes.ts` (trang pairing mock `/p/:code`) render HTML ở server với **text tiếng Hàn viết chết trong code**, không qua cơ chế đa ngôn ngữ nào — khách Việt Nam vào các trang này sẽ thấy tiếng Hàn.

## Cách xử lý

Không tạo cơ chế i18n mới. Tận dụng đúng pattern project đã dùng cho trang kết quả (`server/src/pages.ts` → `/r/:token`):

1. Server đọc 3 file dịch có sẵn `packages/shared/src/i18n/{vi,en,ko}.json` (cùng file kiosk app đang dùng).
2. Nhúng nguyên khối JSON đó vào `<script>` của trang (`const DICTS = {...}`).
3. Trình duyệt tự xác định ngôn ngữ qua `navigator.language`, dùng hàm `t(key, vars)` nhỏ để tra cứu chuỗi theo key, fallback về `en` nếu thiếu.
4. Toàn bộ text hiển thị cho khách (tiêu đề, nút, thông báo lỗi, alert, màn hình xác nhận nhân viên...) được thay bằng `t('vote.xxx')` / `t('pairing.xxx')` thay vì chuỗi tiếng Hàn cứng.

Vì 3 file render HTML (`pages.ts`, `votePages.ts`, `pairingRoutes.ts`) đều cần đọc cùng 3 file JSON, phần đọc file được tách ra 1 module dùng chung để không lặp code.

## File đã tạo / sửa

| File | Thay đổi |
|---|---|
| `server/src/i18nDicts.ts` | **File mới.** Đọc `packages/shared/src/i18n/{vi,en,ko}.json` 1 lần, export `dicts` dùng chung cho các trang server-rendered. |
| `server/src/pages.ts` | Bỏ đoạn đọc file JSON tại chỗ, import `dicts` từ `i18nDicts.ts` thay thế. Không đổi hành vi. |
| `server/src/votePages.ts` | Xoá toàn bộ text tiếng Hàn hardcode trong `votePageHtml()` và `voteDonePageHtml()`, thay bằng `t('vote.*')`. Nhúng `DICTS` + hàm `t()` vào script client (giống `pages.ts`). |
| `server/src/pairingRoutes.ts` | Xoá toàn bộ text tiếng Hàn hardcode trong `pairingPageHtml()`, thay bằng `t('pairing.*')`. Nhúng `DICTS` + hàm `t()` vào script client. |
| `packages/shared/src/i18n/vi.json` | Thêm namespace `vote` (gồm `vote.staff.*`) và `pairing` (gồm `pairing.errors.*`) — bản dịch tiếng Việt. |
| `packages/shared/src/i18n/en.json` | Thêm cùng namespace `vote` / `pairing` — bản dịch tiếng Anh. |
| `packages/shared/src/i18n/ko.json` | Thêm cùng namespace `vote` / `pairing` — giữ nguyên nội dung tiếng Hàn gốc, chỉ đưa vào cấu trúc key. |

## Namespace key mới (trong cả 3 file JSON)

- `vote.*` — tiêu đề trang, nút bình chọn, thông báo lỗi/tải, alert giới hạn số lượng chọn, text màn "hoàn tất"
- `vote.staff.*` — khung xác nhận nhân viên (PIN, số lượt ghé thăm, trạng thái tặng quà)
- `pairing.*` — tiêu đề, mô tả, nút kết nối, ghi chú "màn hình mô phỏng", màn "kết nối hoàn tất"
- `pairing.errors.*` — 3 mã lỗi claim QR: `not_found`, `expired`, `already_claimed`

## Màn hình bị tác động

| Route | Màn hình | Ảnh hưởng |
|---|---|---|
| `GET /v/:token` | Trang bình chọn sản phẩm | Toàn bộ text hiển thị đổi từ hardcode Hàn → đa ngôn ngữ theo `navigator.language` |
| `GET /v/:token/done` (cùng file, hàm `voteDonePageHtml`) | Trang hoàn tất bình chọn + khung xác nhận nhân viên (giữ PIN) | Như trên, gồm cả text trong khung PIN nhân viên |
| `GET /p/:code` | Trang pairing mock (bấm QR trên PAD dẫn tới) | Toàn bộ text hiển thị đổi từ hardcode Hàn → đa ngôn ngữ |

**Không đổi giao diện/CSS, không đổi logic nghiệp vụ** — chỉ thay nguồn text hiển thị. `GET /r/:token` (trang kết quả) không đổi hành vi, chỉ đổi cách nó lấy `dicts` (từ module dùng chung thay vì tự đọc file).

## Đã kiểm tra

- `tsc --noEmit` ở package `server`: sạch, không lỗi type.
- `vitest run` ở package `packages/shared` (37 test, gồm test parity key giữa vi/en/ko): pass.
- Grep xác nhận không còn text tiếng Hàn nào hiển thị cho khách trong `votePages.ts` / `pairingRoutes.ts` (chỉ còn comment cho dev).
- Đối chiếu từng key `t('...')` dùng trong code với cả 3 file JSON: khớp đầy đủ.
- Phát hiện và sửa 1 lỗi trùng tên biến (`lookup`) giữa helper i18n và hàm tra cứu PIN nhân viên trong `voteDonePageHtml` — đã đổi tên hàm PIN-lookup thành `staffLookup`.

## Chưa làm / cần làm tiếp

- **Chưa commit** — các thay đổi trên vẫn ở working tree.
- **Chưa test tay qua trình duyệt thật** (mở `/v/:token`, `/v/:token/done`, `/p/:code` với `navigator.language` là `vi` và `en` để xem bằng mắt). Cách lấy token/code thật để test: xem hướng dẫn curl/PowerShell đã trao đổi trong phiên làm việc trước.
- **Giai đoạn 2 (chưa làm):** hiện text vẫn nằm trong file JSON trong repo — sửa vẫn cần dev + commit + deploy. Nếu muốn người phụ trách nội dung (không phải dev) tự sửa được qua web, cần thêm bảng DB `content_strings` + màn hình admin editor, theo đúng pattern `/admin/catalog` đã có sẵn cho brand/product.
