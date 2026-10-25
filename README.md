# FoodHub

Website review quán ăn (HTML, CSS, JavaScript, Vite + Express API).

## Nguồn dữ liệu

- Nguồn dữ liệu duy nhất của luồng chạy chính là `data/foodhub.json`.
- `db.json` là dữ liệu legacy, KHÔNG được dùng trong luồng chạy chính (chỉ giữ lại để tham khảo).

## Chạy dự án

```bash
npm install
npm run dev
```

Lệnh `npm run dev` chạy Vite (frontend) cùng Express API (`server/index.js`), đọc/ghi trực tiếp `data/foodhub.json`.

Các lệnh khác:

- `npm run seed`: tạo tài khoản mẫu (admin, customer).
- `npm run test:api`: chạy bộ test API.
- `npm run build`: build production bằng Vite.

## Luồng đặt hàng (giỏ hàng -> thanh toán)

- `cart.html`: quản lý giỏ hàng (ảnh, tên quán, giá, số lượng, thành tiền), tăng/giảm số lượng, xóa món, áp mã ưu đãi và xem lịch sử đơn. Nhấn **Tiến hành thanh toán** để sang trang thanh toán.
- `checkout.html`: nhập họ tên, số điện thoại, email, địa chỉ giao hàng chi tiết (Tỉnh/Thành phố, Quận/Huyện, Phường/Xã, số nhà/tên đường, địa chỉ bổ sung), chọn phương thức thanh toán (COD / Chuyển khoản), ghi chú và xác nhận email bằng OTP trước khi đặt hàng.
- Mã ưu đãi đã áp ở trang giỏ hàng được giữ nguyên khi sang trang thanh toán.

## Xác nhận email khi đặt hàng

Server có API xác thực email thật (không mô phỏng ở giao diện):

- `POST /api/email/send-otp` `{ email }`: tạo mã OTP 6 chữ số, lưu **hash** kèm thời hạn 10 phút và cooldown gửi lại 60 giây trong `data/foodhub.json` (khóa `emailVerifications`).
- `POST /api/email/verify-otp` `{ email, otp }`: kiểm tra mã (giới hạn 5 lần nhập sai). Khi đúng, trả về `verificationToken` có hiệu lực 30 phút.
- `POST /api/orders` **bắt buộc** có `contactEmail` + `emailVerificationToken` hợp lệ; đơn sẽ bị từ chối nếu email chưa được xác nhận. Token chỉ dùng được một lần cho một đơn.

### Cấu hình gửi email thật (tùy chọn)

Mặc định dự án **chưa cấu hình SMTP**. Hệ thống vẫn tạo và xác thực OTP thật ở server, nhưng để phát triển/kiểm thử thì mã OTP được in ra console server và trả kèm trong response (`devCode`, chỉ khi `NODE_ENV != production`).

Để gửi email thật, cài nodemailer và khai báo biến môi trường (xem `.env.example`):

```bash
npm install nodemailer
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="FoodHub" <your-account@gmail.com>
```

Khi đã cấu hình, OTP sẽ được gửi qua email và không còn trả `devCode` trong response.
