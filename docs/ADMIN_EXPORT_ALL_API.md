# `GET /api/admin/export/all`

Trả về một lần toàn bộ dữ liệu của trang admin và của file Excel (`sessions.xlsx`) dưới dạng JSON.

## Request

**Header (bắt buộc):** `x-admin-key: <ADMIN_KEY>`. Thiếu hoặc sai thì trả `401 {ok:false, error:{code:"unauthorized"}}`.

**Query (đều tùy chọn):**

| Tham số | Kiểu | Tác dụng |
|---|---|---|
| `from` | chuỗi ISO, vd `2026-10-13` hoặc `2026-10-13T00:00:00Z` | Mốc bắt đầu, **chỉ áp dụng cho `analytics`**. So sánh chuỗi với `started_at` / `answered_at` / `ts`. Mặc định `0000`. |
| `to` | giống `from` | Mốc kết thúc, chỉ áp dụng cho `analytics`. Mặc định `9999`. |

Lưu ý với `to`: so sánh theo chuỗi, nên `to=2026-10-13` sẽ **không** gồm các bản ghi trong ngày 13 (vì `2026-10-13T08:…` lớn hơn `2026-10-13`). Muốn gồm cả ngày 13 thì truyền `to=2026-10-14`.

`overview`, `sessions`, `answers`, `votes`, `registrations` **không bị ảnh hưởng** bởi `from`/`to`.

## Response

```json
{ "ok": true, "data": { "generatedAt", "overview", "analytics", "sessions", "answers", "votes", "registrations" } }
```

Mọi thời gian là chuỗi **UTC ISO** (`2026-10-13T08:30:00.000Z`), không đổi sang giờ Việt Nam. Các field có thể `null` đều ghi rõ bên dưới.

### `generatedAt`
Thời điểm server tạo response.

### `overview` (số liệu hôm nay)
Ngày "hôm nay" tính theo `todayPrefix()` của server.

| Field | Ý nghĩa |
|---|---|
| `today.started` | Số phiên bắt đầu hôm nay, **không tính** `revisit`. |
| `today.completed` | Số phiên `completed` bắt đầu hôm nay. |
| `today.abandoned` | Số sự kiện `session.abandoned` ghi hôm nay. |
| `today.active` | Số phiên `active` bắt đầu trong 10 phút gần nhất. |
| `completionRate` | `completed / started` theo %, làm tròn. `null` nếu `started = 0`. |
| `avgDurationSec` | Thời gian trung bình (giây) từ bắt đầu đến hoàn tất của các phiên completed hôm nay. `null` nếu chưa có. |
| `qr.issued` | Số sự kiện `qr.issued` hôm nay (đã tạo QR kết quả). |
| `qr.scanned` | Số sự kiện `result.scanned` hôm nay (khách quét QR kết quả). |
| `qr.scanRate` | `scanned / issued` theo %. `null` nếu `issued = 0`. |
| `downloads` | Số sự kiện `result.downloaded` hôm nay. |
| `retakeRate` | `retakes / (captures + retakes)` theo %. `null` nếu chưa có ảnh chụp nào. |
| `devices[]` | Danh sách thiết bị: `id`, `name`, `last_heartbeat` (lần heartbeat cuối), `app_version`, `state` (trạng thái, vd `battery:80`). |

### `analytics` (theo `from`/`to`)

| Field | Ý nghĩa |
|---|---|
| `axisAverages` | Object điểm trung bình (làm tròn, 0-100) theo từng trục: `repick`, `value`, `care`, `trend`, `localFit`, `trust`. `null` nếu trục chưa có câu trả lời. |
| `personaDistribution[]` | `{persona, n}`: số phiên theo từng persona, giảm dần. |
| `hourlyParticipants[]` | `{hour, n}`: số phiên bắt đầu theo giờ (`"08"`, `"09"`, …). **Giờ UTC**, không phải giờ Việt Nam. |
| `subtypes` | Theo từng trục (6 trục như trên): mảng `{subtype, n}` phân bố subtype của câu trả lời. |
| `marketingConsents` | Số sự kiện `consent.marketing` (đồng ý nhận marketing). |
| `productClicks[]` | `{pid, n}`: số lần bấm từng sản phẩm (`pid` là id sản phẩm), giảm dần. |

### `sessions[]` (toàn bộ, không phân trang, mới nhất trước)
Đã bỏ các dòng `revisit` trùng số điện thoại với phiên gốc.

| Field | Ý nghĩa |
|---|---|
| `id` | ID phiên. |
| `device_id` | ID kiosk tạo phiên. |
| `language` | Ngôn ngữ khách chọn: `vi`, `en`, `ko`. |
| `status` | `active` (đang chơi), `completed` (xong), `revisit` (khách quét lại số đã có kết quả). Có thể có giá trị khác nếu code ở nơi khác đặt. |
| `full_name` | Họ tên (từ QR check-in hoặc form). `null` nếu không có. |
| `gender` | Giới tính. `null` nếu không có. |
| `age_group` | Với phiên quét QR: **ngày sinh dạng chuỗi gốc** (vd `1995-03-02T00:00:00`). Với form nhập tay: nhóm tuổi như `teen`, `twenties`. |
| `phone` | Số điện thoại. Chỉ có khi quét QR, `null` nếu nhập tay. |
| `persona` | Persona kết quả. `null` nếu chưa hoàn tất. |
| `started_at` | Lúc bắt đầu. |
| `completed_at` | Lúc hoàn tất. `null` nếu chưa xong. |
| `voted_at` | Lúc bình chọn sản phẩm. `null` nếu chưa bình chọn. |
| `reward_claimed_at` | Lúc nhân viên xác nhận tặng quà. `null` nếu chưa tặng. |

### `answers[]`
Mỗi dòng là câu trả lời của một trục trong một phiên (tối đa 6 dòng mỗi phiên).

| Field | Ý nghĩa |
|---|---|
| `session_id` | ID phiên. |
| `full_name` | Họ tên của phiên đó (có thể `null`). |
| `core_key` | Trục: `repick`, `value`, `care`, `trend`, `localFit`, `trust`. |
| `subtype` | Subtype tính ra từ câu trả lời của trục đó. |
| `score` | Điểm của trục (số nguyên 0-100). |
| `answered_at` | Lúc trả lời. |

### `votes[]` (mới nhất trước)

| Field | Ý nghĩa |
|---|---|
| `session_id` | Phiên đã bình chọn (có thể `null`). |
| `full_name` | Họ tên (có thể `null`). |
| `product_ids` | **Mảng** id sản phẩm đã chọn. |
| `products` | Mảng tên tương ứng dạng `"Tên (VI) – Tên thương hiệu"`. Nếu không tìm được sản phẩm thì trả lại chính id. |
| `voted_at` | Lúc bình chọn. |
| `reward_claimed_at` | Lúc tặng quà, `null` nếu chưa. |
| `reward_staff` | Tên nhân viên đã xử lý tặng quà, `null` nếu chưa. |

### `registrations[]` (check-in Zalo, mới nhất trước)

| Field | Ý nghĩa |
|---|---|
| `id` | ID dòng trong DB. |
| `external_id` | ID bên ngoài, webhook dùng để chống trùng. Có thể `null`. |
| `qr_code` | Mã QR check-in. |
| `full_name`, `phone`, `dob`, `gender` | Thông tin khách đăng ký. Mỗi field có thể `null`. |
| `received_at` | Lúc server nhận webhook. |

## Ghi chú
- Chưa có phân trang, dữ liệu lớn thì response cũng lớn.
- `sessions` và file Excel đều ẩn dòng `revisit` trùng số điện thoại với phiên gốc.
