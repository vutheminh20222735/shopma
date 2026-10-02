# Database

SQLite trên máy, kết nối và migration tại `index.ts`. `schema/` chia bảng theo tính năng, `schema.ts` tập hợp schema Drizzle, `migrations/` chứa SQL và metadata, `seeds/` chứa dữ liệu mẫu.

12 bảng: shop, members, credentials, auth_sessions, invitations, preview_sessions, products, variants, cart, favorites, orders, coupons. Bảng schema_migrations ghi các migration đã áp dụng. File database nằm trong data/ và không đóng gói.

Xem `HUONG_DAN_CHAY.md` để chạy và tạo migration mới.
