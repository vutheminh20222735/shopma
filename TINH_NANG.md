# Code theo từng tính năng

`client/src/app` chứa giao diện Angular, `server` chứa API và nghiệp vụ, `database` chứa bảng và migration.

| Tính năng | Giao diện | API / nghiệp vụ | Database |
| --- | --- | --- | --- |
| Trang chủ và chính sách | `client/src/app/features/home/` | — | Dùng dữ liệu sản phẩm |
| Sản phẩm, tìm kiếm, lọc, chi tiết, size | `client/src/app/features/products/` | `server/features/products/` | `database/schema/products.ts` |
| Yêu thích | `client/src/app/features/favorites/` | `server/features/favorites/` | `database/schema/favorites.ts` |
| Giỏ hàng và giao diện thanh toán | `client/src/app/features/cart/` | `server/features/cart/`, tạo đơn qua `orders` | `database/schema/cart.ts` |
| Lịch sử và xử lý đơn hàng | `client/src/app/features/orders/` | `server/features/orders/` | `database/schema/orders.ts` |
| Tồn kho theo size/màu | `client/src/app/features/inventory/` | `server/features/inventory/` | `database/schema/inventory.ts` |
| Mã ưu đãi | `client/src/app/features/coupons/` | `server/features/coupons/` | `database/schema/coupons.ts` |
| Đăng nhập, đăng ký và phân quyền | `client/src/app/features/accounts/` | `server/features/accounts/` | `database/schema/accounts.ts` |
| Zalo, Facebook, SĐT và cấu hình shop | `client/src/app/features/contacts/` | `server/features/contacts/` | `database/schema/contacts.ts` |
| Tổng quan quản trị | `client/src/app/features/dashboard/` | `server/features/dashboard/` | Tổng hợp đơn và tồn kho |
| Điều hướng, header/footer, khung quản trị | `client/src/app/features/app/` | Điều phối chung tại `server/routes/shop.ts` | — |

Thành phần dùng chung nằm tại `client/src/app/shared/` và `server/shared/`. Trạng thái cửa hàng: `client/src/app/shop/shop.service.ts`. Hướng dẫn cài đặt nằm trong `HUONG_DAN_CHAY.md`.
