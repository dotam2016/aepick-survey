# AEPICK BEAUTY DNA — Hướng dẫn cài đặt Supabase

> Làm theo thứ tự từ trên xuống. Chỉ cần làm 1 lần cho mỗi project Supabase (local dev, staging, production — mỗi môi trường 1 project riêng nếu cần).

---

## 1. Tạo project Supabase

1. Vào https://supabase.com/dashboard → đăng nhập (hoặc tạo tài khoản, có gói miễn phí).
2. **New project** → đặt tên (ví dụ `aepick-beauty-dna-dev`).
3. Đặt **Database Password** — lưu lại chỗ nào đó an toàn, sẽ cần dùng ngay bước sau. Nếu quên, có thể reset ở Project Settings sau này.
4. Chọn **Region** gần Việt Nam nhất (ví dụ Singapore — `ap-southeast-1`).
5. Bấm **Create new project**, đợi khoảng 1-2 phút để Supabase khởi tạo xong.

## 2. Lấy connection string

1. Trong project vừa tạo: **Project Settings** (icon bánh răng) → **Database**.
2. Kéo xuống mục **Connection string** → chọn tab **URI**.
3. Chọn **Transaction pooler** (cổng `6543`) — loại kết nối phù hợp cho server chạy liên tục, gửi nhiều query ngắn (khác với "Direct connection", vốn hợp cho công cụ chạy 1 lần như migration script).
4. Copy chuỗi này, dạng:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
5. Thay `[YOUR-PASSWORD]` bằng mật khẩu database đã đặt ở bước 1.

## 3. Tạo bảng (chạy schema)

1. Trong project: **SQL Editor** (icon ở sidebar bên trái) → **New query**.
2. Mở file `server/sql/schema.sql` trong repo này, copy toàn bộ nội dung.
3. Paste vào SQL Editor → bấm **Run** (hoặc `Ctrl+Enter`).
4. Sẽ thấy thông báo "Success. No rows returned" — nghĩa là đã tạo xong 10 bảng + index.

**Kiểm tra lại (không bắt buộc, nhưng nên làm):** vẫn trong SQL Editor, chạy:

```sql
select table_name from information_schema.tables where table_schema = 'public' order by 1;
```

Phải thấy đủ 10 bảng: `answers, brand_products, brands, devices, events, pairings, results, sessions, visitors, votes`.

```sql
select column_name from information_schema.columns where table_name = 'sessions' order by 1;
```

Phải thấy có `full_name`, `gender`, `age_group` (3 cột lưu thông tin thu ở màn đồng ý trước khảo sát).

> File `schema.sql` an toàn để chạy lại nhiều lần (mọi câu lệnh đều có `IF NOT EXISTS`) — chạy lại không xóa dữ liệu hay báo lỗi nếu bảng đã tồn tại.

## 4. Cấu hình `.env`

Ở thư mục gốc repo:

```bash
cp .env.example .env
```

Mở file `.env` vừa tạo, dán connection string đã lấy ở bước 2 vào:

```
SUPABASE_DB_URL=postgresql://postgres.xxxxxxxxxxxx:mat-khau-that@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

File `.env` đã nằm trong `.gitignore` — không bị commit lên git, an toàn để lưu mật khẩu thật ở đây.

## 5. Chạy thử

```bash
npm install
npm run demo:seed      # (tùy chọn) tạo sẵn vài chục session demo để màn chờ/admin không trống
npm run demo           # build kiosk + chạy server (HTTPS, cổng 8787)
```

Hoặc trên Windows, bấm đúp `START-DEMO.bat` — file này giờ sẽ báo lỗi rõ ràng nếu quên tạo `.env` (`[ERROR] .env file not found`) thay vì crash không rõ nguyên nhân.

**Xác nhận đã kết nối đúng:**
- Mở `https://localhost:8787/admin`, nhập admin key (mặc định `aepick-admin`, xem/đổi bằng biến `ADMIN_KEY`) → nếu thấy số liệu (kể cả 0) thay vì "auth failed"/"offline" là đã kết nối Supabase thành công.
- Vào Supabase Dashboard → **Table Editor** → bảng `sessions` → nếu bạn vừa chạy `demo:seed` hoặc trải nghiệm thử trên kiosk, sẽ thấy dòng dữ liệu mới xuất hiện ở đây gần như ngay lập tức.

## 6. Lưu ý trước khi có dữ liệu khách hàng thật

`server/src/db.ts` hiện kết nối với `ssl: { rejectUnauthorized: false }` (không xác thực chứng chỉ TLS chặt) — đây là cách kết nối phổ biến khi dùng `pg` với Supabase và **chấp nhận được ở giai đoạn dev/demo** (chưa có dữ liệu khách hàng thật). Trước khi vận hành thật với dữ liệu khách (họ tên/giới tính/tuổi thu ở màn đồng ý), nên đổi sang xác thực chứng chỉ đầy đủ — chi tiết xem `docs/VN_07_BE_Handover Document.md` mục 5-1.

Cũng nhớ đổi các biến mặc định trước khi triển khai thật: `ADMIN_KEY`, `STAFF_PIN`, `VISITOR_HASH_SALT` (xem mục 5-4 của tài liệu bàn giao).

## 7. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `SUPABASE_DB_URL is not set` khi chạy server | Chưa tạo `.env`, hoặc `.env` không có biến này | Làm lại bước 4 |
| `relation "brands" does not exist` (hoặc bảng khác) | Chưa chạy `schema.sql` trên đúng project Supabase đang trỏ tới | Làm lại bước 3, kiểm tra connection string trong `.env` đúng project chưa |
| `password authentication failed` | Sai mật khẩu trong connection string | Vào Project Settings → Database → **Reset database password**, cập nhật lại `.env` |
| `.bat` báo "[ERROR] .env file not found" | Đang chạy `START-DEMO.bat`/`START-TUNNEL.bat` mà chưa có `.env` ở thư mục gốc | Làm lại bước 4 (chú ý: file `.env` phải nằm ở thư mục gốc repo, không phải trong `server/`) |
