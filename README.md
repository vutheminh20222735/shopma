# M&A Shop

Project độc lập cho shop quần áo, giao diện tiếng Việt, logo riêng và liên hệ Zalo/Facebook/SĐT.

Công nghệ: **Angular 19** + TypeScript ở client; Node.js/Express ở server; SQLite và migration SQL ở database. Đăng ký, đăng nhập và đăng xuất bằng email–mật khẩu của shop. Mật khẩu được băm scrypt; phiên đăng nhập lưu bằng cookie HttpOnly.

## Chạy nhanh

Cài Node.js từ 22.13.0, mở Terminal trong thư mục `ma-shop` có `package.json`:

```bash
npm ci
npm run setup:admin
npm run dev
```

Lệnh setup hỏi tên, email và mật khẩu chủ shop. Mở http://localhost:5173. Server API chạy trên cổng 3001; database và dữ liệu sản phẩm mẫu được khởi tạo tự động. Không có tài khoản/mật khẩu mặc định.

Xem [HUONG_DAN_CHAY.md](HUONG_DAN_CHAY.md) để cấu hình, build và chạy production. Xem [TINH_NANG.md](TINH_NANG.md) để tìm code theo tính năng.

| Thư mục | Nội dung |
| --- | --- |
| `client/src/app/features/` | Màn hình Angular theo từng tính năng |
| `client/src/app/shared/`, `client/src/styles.css`, `client/public/` | UI dùng chung, CSS, logo và ảnh |
| `server/features/` | API, nghiệp vụ, đăng nhập và phân quyền theo tính năng |
| `server/routes/`, `server/shared/` | Điều phối API, cấu hình và helper |
| `server/scripts/`, `server/tests/` | Lệnh chạy, setup chủ shop và kiểm tra |
| `database/schema/`, `database/migrations/`, `database/seeds/` | Schema, migration và dữ liệu mẫu |

Bốn vai trò: admin (chủ shop), manager (quản lý), staff (nhân viên), customer (khách hàng). Quyền được kiểm tra tại server. Thành viên đăng ký trước; chủ shop cấp quyền quản lý hoặc nhân viên sau đó.

Đã có đánh giá sản phẩm, timeline đơn, thông báo SSE, ưu đãi chào mừng/sinh nhật/kỷ niệm, upload ảnh, báo cáo doanh thu. Thanh toán và vận chuyển dùng lớp stub (`PAYMENTS_LIVE=0`); chưa thu tiền thật cho đến khi cấu hình nhà cung cấp và bí mật webhook.
