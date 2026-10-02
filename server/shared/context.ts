import type { ShopDatabase } from '@database/index';
import type { getSession } from '@server/features/accounts/server/session';
export type ShopRequestContext = {
    req: Request;
    url: URL;
    area: string;
    id: string;
    db: ShopDatabase;
    s: Awaited<ReturnType<typeof getSession>>;
    body: Record<string, any>;
};
