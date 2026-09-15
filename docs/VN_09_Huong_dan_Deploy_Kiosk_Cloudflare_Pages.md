# AEPICK BEAUTY DNA — Hướng dẫn deploy kiosk lên Cloudflare Pages (free)

> Chỉ áp dụng cho `apps/kiosk` (frontend React/Vite). Backend (`server/`) vẫn phải host riêng
> (local, VPS, Railway...) — xem ghi chú ở mục 5. Làm theo thứ tự từ trên xuống, chỉ cần làm
> 1 lần cho mỗi project Cloudflare Pages (dev/staging/production — mỗi môi trường 1 project
> riêng nếu cần).

---

## 0. Điều kiện trước khi bắt đầu

- Code đã có 2 thay đổi hỗ trợ deploy tách domain (đã làm sẵn trong repo):
  - `apps/kiosk/src/api.ts` — gọi API qua biến `VITE_API_BASE`, để trống thì tự dùng đường dẫn
    tương đối như cũ (không ảnh hưởng chạy local).
  - `server/src/index.ts` đã bật CORS mở (`origin: true`) — backend chấp nhận gọi từ domain
    Cloudflare Pages mà không cần sửa gì thêm.
- Backend (`server/`) đã chạy được ở đâu đó và có domain/IP truy cập từ internet (không phải
  `localhost`) — kiosk trên Cloudflare Pages sẽ gọi vào domain này.
- Repo đã đẩy lên GitHub (Cloudflare Pages build trực tiếp từ GitHub).

## 1. Tạo project trên Cloudflare Pages

1. Vào https://dash.cloudflare.com → đăng nhập (hoặc tạo tài khoản, free tier không cần thẻ).
2. Sidebar trái → **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**.
3. Chọn GitHub, cấp quyền, chọn repo `aepick-survey`.
4. Đặt **Project name** — đây cũng chính là phần đầu của domain cố định
   (`<project-name>.pages.dev`), nên đặt tên gọn, không đổi sau này nếu không muốn đổi domain.
   Ví dụ: `aepick-kiosk`.

## 2. Cấu hình build

Vì đây là monorepo dùng npm workspaces (`@aepick/kiosk` phụ thuộc `@aepick/shared`), **không**
build trực tiếp trong thư mục `apps/kiosk` — phải build từ gốc repo để workspace link đúng.

| Mục | Giá trị |
|---|---|
| Root directory | để trống (gốc repo) |
| Build command | `npm install && npm run build -w @aepick/kiosk` |
| Build output directory | `apps/kiosk/dist` |
| Framework preset | `None` |

## 3. Set biến môi trường

Vẫn ở màn hình cấu hình project (hoặc sau này ở **Settings → Environment variables**):

| Name | Value | Ghi chú |
|---|---|---|
| `VITE_API_BASE` | `https://<domain-backend-cua-ban>` | Domain nơi `server/` đang chạy thật (không có dấu `/` ở cuối) |

Set cho cả **Production** và **Preview** nếu bạn cũng test qua preview URL.

> Biến này bắt buộc phải set **trước khi build** vì Vite inline giá trị vào bundle lúc build —
> đổi sau phải **Retry deployment** (build lại) mới nhận giá trị mới, không tự áp dụng như biến
> môi trường server thông thường.

## 4. Deploy lần đầu

1. Bấm **Save and Deploy**. Cloudflare build và deploy — theo dõi log ngay trên dashboard.
2. Build xong, Cloudflare cấp domain cố định dạng:
   ```
   https://aepick-kiosk.pages.dev
   ```
   Domain này **không đổi** giữa các lần deploy — mỗi lần push code lên nhánh production
   (thường là `main`), Cloudflare build lại và domain này tự trỏ sang bản mới nhất.
3. Mở domain đó, xác nhận kiosk load được, không có lỗi gọi API (mở DevTools → tab Network,
   kiểm tra các request `/api/...` có đi đúng tới domain backend đã set ở bước 3 không, và trả
   về `200` chứ không phải bị CORS chặn hay 404).

> Mỗi lần deploy nhánh khác/PR khác sẽ có thêm 1 URL preview riêng dạng
> `<hash>.aepick-kiosk.pages.dev` — đây là phụ, không ảnh hưởng domain chính ở bước 4.2.

## 5. (Tuỳ chọn) Gắn domain riêng thay vì `.pages.dev`

Nếu đã có domain riêng (ví dụ `aepick.vn`):

1. Trong project vừa tạo: **Custom domains** → **Add a custom domain**.
2. Nhập domain con muốn dùng, ví dụ `kiosk.aepick.vn`.
3. Cloudflare hướng dẫn thêm 1 bản ghi CNAME (nếu domain đã quản lý DNS ở Cloudflare thì tự
   động luôn, không cần thao tác thủ công).
4. Đợi vài phút để DNS + SSL propagate — Cloudflare tự cấp chứng chỉ HTTPS miễn phí.

Gắn domain riêng **miễn phí**, không cần nâng cấp gói trả phí.

## 6. Lưu ý về backend (`server/`)

Cloudflare Pages chỉ host được phần tĩnh (`apps/kiosk`). Phần `server/` (Fastify + Postgres,
xử lý session/pairing/admin/catalog) là 1 process Node giữ kết nối liên tục tới Postgres —
**không chạy được trên Cloudflare Pages/Workers** ở dạng hiện tại. Vẫn cần chạy nó ở:
- Máy kiosk tại chỗ (local, như hiện tại), hoặc
- 1 host chạy Node liên tục (VPS, Railway, Fly.io, Render...).

Domain/IP của nơi host `server/` chính là giá trị bạn điền vào `VITE_API_BASE` ở bước 3.

## 7. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| Kiosk load được nhưng đứng yên ở màn hình đầu, không tạo được session | `VITE_API_BASE` sai hoặc chưa set | Kiểm tra lại **Settings → Environment variables**, đúng domain backend, rồi **Retry deployment** |
| Request `/api/...` báo lỗi CORS trên DevTools Console | Backend chưa bật CORS hoặc đang trỏ nhầm bản cũ | Xác nhận `server/src/index.ts` có `app.register(cors, { origin: true })` và backend đã redeploy bản mới nhất |
| Build lỗi kiểu "Cannot find module '@aepick/shared'" | Root directory bị set thành `apps/kiosk` thay vì gốc repo | Sửa lại theo bảng ở mục 2 (Root directory để trống) |
| Đổi `VITE_API_BASE` xong nhưng kiosk vẫn gọi domain cũ | Vite đã inline giá trị cũ vào bundle lúc build trước | Vào **Deployments** → bấm **Retry deployment** (hoặc push 1 commit mới) để build lại |
| Ảnh/logo kiosk không hiện | Hiếm khi xảy ra vì ảnh nằm trong `apps/kiosk/public/`, được bundle sẵn — nếu vẫn thiếu thì kiểm tra Build output directory đúng `apps/kiosk/dist` chưa | Sửa lại theo bảng ở mục 2 |
