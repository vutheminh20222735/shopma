# Server

API Node.js/Express tại `index.ts`. `features/` chia handler và helper theo tính năng; `routes/shop.ts` điều phối; `shared/` chứa cấu hình, database, validation, response và lỗi. `scripts/` chứa lệnh phát triển và setup chủ shop; `tests/` chứa kiểm tra HTTP trên database tạm.

Schema, migration và seed nằm trong `database/`. Chạy `npm run dev` hoặc `npm start` từ thư mục gốc.
