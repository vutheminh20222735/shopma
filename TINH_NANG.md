# Code theo từng tính năng

`client/src/app` = giao diện Angular, `server` = API và nghiệp vụ, `database` = bảng và migration.

| Tính năng | Giao diện | API / nghiệp vụ | Database |
| --- | --- | --- | --- |
| Trang chủ và chính sách | `client/src/app/features/home/` | — | Dùng dữ liệu sản phẩm |
| Sản phẩm, ảnh, biến thể, quyền sửa | `client/src/app/features/products/` | `server/features/products/` | `products`, `variants`, `product_images`, `product_edit_grants` |
| Đánh giá và hỏi đáp | `client/src/app/features/reviews/` | `server/features/reviews/` | `product_reviews`, `product_comments`, `review_moderation_logs` |
| Yêu thích | `client/src/app/features/favorites/` | `server/features/favorites/` | `favorites` |
| Giỏ hàng và thanh toán | `client/src/app/features/cart/` | `server/features/cart/`, `orders`, `offers` | `cart` |
| Đơn hàng, timeline, hủy/đổi size | `client/src/app/features/orders/` | `server/features/orders/` | `orders`, `order_events`, `order_refunds` |
| Sổ địa chỉ nhận hàng | `client/src/app/features/addresses/` | `server/features/addresses/` | `member_addresses` |
| Thông báo đơn mới (SSE) | `client/src/app/features/notifications/` | `server/features/notifications/` | `notifications` |
| Ưu đãi chào mừng / sinh nhật / kỷ niệm | `client/src/app/features/offers/`, `accounts/profile-form` | `server/features/offers/` | `offer_configs`, `member_offers`, `benefit_claims`, `otp_codes` |
| Tồn kho theo size/màu | `client/src/app/features/inventory/` | `server/features/inventory/` | `variants` |
| Mã ưu đãi chung | `client/src/app/features/coupons/` | `server/features/coupons/` | `coupons` |
| Báo cáo doanh thu | `client/src/app/features/reports/` | `server/features/reports/` | Tổng hợp `orders` / `order_refunds` |
| Thanh toán & vận chuyển (stub) | Trong chi tiết đơn | `server/features/payments/`, `shipping/` | `payment_transactions`, `shipping_shipments` |
| Đăng nhập, đăng ký, phân quyền | `client/src/app/features/accounts/` | `server/features/accounts/` | `members`, sessions, reset |
| Zalo, Facebook, SĐT | `client/src/app/features/contacts/` | `server/features/contacts/` | `shop` / contacts |
| Tổng quan quản trị | `client/src/app/features/dashboard/` | `server/features/dashboard/` | Tổng hợp đơn và tồn kho |
| Điều hướng, header/footer, khung quản trị | `client/src/app/features/app/` | `server/routes/shop.ts` | — |

Migration mới: `0005_shop_features_bundle.sql`, `0006_backfill_orders_payment.sql` (tự chạy khi khởi động server).

Thành phần dùng chung: `client/src/app/shared/`, `server/shared/`. Trạng thái cửa hàng: `client/src/app/shop/shop.service.ts`. Hướng dẫn: `HUONG_DAN_CHAY.md`.
