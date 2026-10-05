import type { ShopDatabase } from '@database/index';
import type { getSession } from '@server/features/accounts/server/session';
export type ShopRequestContext = {
    req: Request;
    url: URL;
    area: string;
    id: string;
    /** Đoạn đường dẫn thứ 3: /api/shop/{area}/{id}/{action} */
    action?: string;
    db: ShopDatabase;
    s: Awaited<ReturnType<typeof getSession>>;
    body: Record<string, any>;
    /** Nội dung thô của request (dùng để kiểm tra chữ ký webhook). */
    rawBody?: string;
};
