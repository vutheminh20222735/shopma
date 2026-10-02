# Hướng dẫn chạy M&A Shop

## 1. Cài đặt

Cài Node.js từ 22.13.0 trở lên. Mở thư mục `ma-shop` (có `package.json` gốc). Mọi lệnh trong hướng dẫn chạy tại thư mục này.

```bash
node --version
npm ci
npm run setup:admin
npm run dev
```

`npm ci` cài cả server và client Angular (npm workspaces). `setup:admin` hỏi tên, email và mật khẩu chủ shop (10–128 ký tự). Lệnh chỉ tạo chủ shop lần đầu, không đổi hoặc ghi đè tài khoản đã có. Không có mật khẩu mặc định.

Mở http://localhost:5173. Lệnh `npm run dev` chạy cả Angular (Vite-free, `ng serve`) và server Express. Nhấn Ctrl+C để dừng. Lần sau chỉ cần `npm run dev`.

## 2. Cấu trúc và database

| Thành phần | Công nghệ / điểm vào |
| --- | --- |
| Client | Angular 19, TypeScript; `client/src/main.ts` và `client/src/index.html` |
| Server | Node.js, Express, TypeScript; `server/index.ts` |
| API | `/api/shop/*`; điều phối tại `server/routes/shop.ts` |
| Database | SQLite trên máy, kết nối tại `database/index.ts` |
| Schema | Drizzle tại `database/schema/` |
| Migration | SQL tại `database/migrations/` |
| Dữ liệu mẫu | `database/seeds/catalog.ts` và `initialize.ts` |

Client chạy cổng 5173; API chạy cổng 3001. Angular proxy `/api` tới backend (`client/proxy.conf.json`). Có thể chạy riêng bằng `npm run dev:client` và `npm run dev:server` trong hai Terminal.

Server dùng TSX để chạy TypeScript trên Node.js. Client Angular nằm trong workspace `client/` với `package.json` riêng.

Database mặc định ở `database/data/ma-shop.sqlite`. Thư mục này được tạo tự động. Migration đã chạy được ghi lại; khởi động lại server không nhập lại SQL hoặc xóa dữ liệu.

Có thể gọi thủ công:

```bash
npm run db:migrate
npm run db:seed
```

Seed chỉ khởi tạo bộ sưu tập mẫu khi database chưa có sản phẩm. Sửa file seed không tự thay đổi sản phẩm đã lưu; sửa qua màn hình quản trị.

## 3. Cấu hình tùy chọn

Project chạy với giá trị mặc định mà không cần file môi trường. Muốn đổi cổng hoặc đường dẫn database, sao chép `.env.example` thành `.env` rồi chỉnh giá trị.

| Biến | Ý nghĩa |
| --- | --- |
| `HOST` | Địa chỉ server bind, mặc định `127.0.0.1` |
| `PORT` | Cổng API, mặc định `3001` |
| `CLIENT_PORT` | Cổng Angular, mặc định `5173` (cấu hình thêm trong `client/angular.json` nếu đổi) |
| `APP_ORIGIN` | Origin giao diện được phép gọi API, không có dấu `/` cuối |
| `DATABASE_PATH` | Đường dẫn file SQLite |
| `SESSION_DAYS` | Thời hạn phiên đăng nhập, từ 1 đến 30 ngày |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tùy chọn nhập thông tin cho lệnh setup chủ shop |

Khi đổi cổng client, đổi `APP_ORIGIN` tương ứng. Ví dụ: `CLIENT_PORT=8080` và `APP_ORIGIN=http://localhost:8080`.

Không đưa `.env` hoặc database cá nhân vào repository hay ZIP chia sẻ. Nếu nhập mật khẩu chủ shop qua biến môi trường, xóa `ADMIN_PASSWORD` khỏi `.env` sau khi setup xong; mật khẩu đã được băm trong database.

## 4. Đăng ký, đăng nhập và phân quyền

Khách hàng mở `/tai-khoan` để đăng ký bằng họ tên, email và mật khẩu. Tài khoản mới luôn có quyền customer. Đăng nhập dùng email–mật khẩu đã tạo. Đăng xuất thu hồi phiên hiện tại.

Chủ shop đăng nhập bằng tài khoản đã tạo bằng `setup:admin`, rồi mở Quản trị → Phân quyền để **tạo tài khoản quản lý/nhân viên** (email + mật khẩu) và gửi cho họ đăng nhập. Khách hàng tự đăng ký tại `/tai-khoan`.

### Quên mật khẩu

1. Khách mở `/tai-khoan` → **Quên mật khẩu?** → nhập email (`/quen-mat-khau`).
2. Server gửi **mã 6 số + liên kết** vào email (SMTP). Trang web **không** hiện mã/link để tránh lộ.
3. Khách mở link trong email, hoặc vào `/dat-lai-mat-khau` rồi nhập email + mã → đặt mật khẩu mới.
4. Phiên cũ bị thu hồi; đăng nhập lại bằng mật khẩu mới. Mã/link hết hạn sau 15 phút.

Cấu hình SMTP trong `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`…). Chưa cấu hình thì server chỉ in mã/link ra console (không trả về trình duyệt).

| Vai trò | Quyền |
| --- | --- |
| Admin / chủ shop | Toàn bộ quản trị, phân quyền và cấu hình liên hệ |
| Manager / quản lý | Sản phẩm, tồn kho, đơn hàng, mã ưu đãi và tổng quan |
| Staff / nhân viên | Xem tồn kho, xử lý các bước giao đơn; không sửa sản phẩm/kho hay hủy đơn |
| Customer / khách hàng | Mua sắm, yêu thích, giỏ hàng, xem đơn của mình và hủy đơn đang chờ xác nhận |

## 5. Trang và tính năng

| Đường dẫn | Nội dung |
| --- | --- |
| `/` | Trang chủ và bộ sưu tập |
| `/san-pham` | Tìm kiếm, lọc và sắp xếp |
| `/san-pham/{id}` | Chi tiết sản phẩm, chọn size/màu |
| `/yeu-thich` | Sản phẩm yêu thích |
| `/gio-hang` | Giỏ hàng |
| `/thanh-toan` | Luồng đặt hàng mẫu |
| `/tai-khoan` | Đăng ký, đăng nhập, đăng xuất và lịch sử đơn |
| `/quan-tri` | Khu vực quản trị theo vai trò |
| `/lien-he` | Zalo, Facebook, số điện thoại và địa chỉ |
| `/chinh-sach` | Chính sách mua sắm |

Logo nằm tại `client/public/images/logo-ma-shop.png`, banner tại `hero-campaign.png`.

## 6. Tìm code và chỉnh sửa

Giao diện ở `client/src/app/features/{tính-năng}`; API và nghiệp vụ ở `server/features/{tính-năng}`; schema ở `database/schema/`.

| File | Mục đích |
| --- | --- |
| `client/src/app/features/app/shop-shell.component.ts` | Shell (header, toast, outlet) |
| `client/src/app/shop/shop.service.ts` | Trạng thái shop, API reload, điều hướng |
| `client/src/app/app.routes.ts` | Routing Angular |
| `client/src/app/shared/api.ts` | Gọi API cùng origin |
| `client/src/styles.css` | CSS và responsive |
| `server/features/accounts/auth-api.ts` | Đăng ký, đăng nhập và đăng xuất |
| `server/shared/config.ts` | Cấu hình môi trường và origin |
| `database/index.ts` | SQLite, transaction và migration |
| `client/angular.json` | Build Angular và proxy API khi phát triển |

## 7. Build, kiểm tra và chạy bản đã build

```bash
npm run build
npm test
npm start
```

Build kiểm tra TypeScript server và tạo `client/dist`. Server Node.js phục vụ giao diện đã build và API tại http://localhost:3001; khi dùng bản này có thể đặt `APP_ORIGIN=http://localhost:3001`.

`npm test` tự tạo database tạm, khởi động server trên cổng localhost tự chọn, chạy kiểm tra rồi dọn database. Không dùng database của shop hiện có.

Luồng đặt hàng và lựa chọn COD/chuyển khoản vẫn là bản mẫu; chưa tích hợp thu tiền hoặc vận chuyển thật.

## 8. Triển khai

Triển khai một dịch vụ Node.js, chạy `npm ci`, `npm run build`, rồi `npm start`. Đặt `HOST=0.0.0.0`, `NODE_ENV=production`, `PORT` theo nhà cung cấp và `APP_ORIGIN` bằng origin HTTPS của shop.

Đường dẫn `DATABASE_PATH` phải nằm trên ổ đĩa lưu trữ bền vững. Sao lưu database định kỳ.

Tạo chủ shop bằng `npm run setup:admin` trên môi trường triển khai trước khi sử dụng quản trị.

## Tài liệu thư viện

- Angular: https://angular.dev/
- Express: https://expressjs.com/en/5x/api/
- SQLite trên Node.js: https://nodejs.org/api/sqlite.html
