# Tài khoản và phân quyền

`auth-api.ts` xử lý đăng ký, đăng nhập và đăng xuất. `api.ts` xử lý phiên, trải nghiệm vai trò và quản lý thành viên. `server/passwords.ts` băm mật khẩu; `server/session.ts` kiểm tra phiên và quyền; `server/owner.ts` tạo chủ shop bằng CLI.

Schema: `database/schema/accounts.ts`. Tài khoản mới luôn có quyền customer; admin cấp quyền cho tài khoản đã đăng ký. API không có endpoint tự nhận quyền chủ shop.
