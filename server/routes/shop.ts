import { database, ensureCatalog, getSession, ShopError } from '@server/shared/shop-server';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
import { accountsApi } from '@server/features/accounts/api';
import { authApi } from '@server/features/accounts/auth-api';
import { config } from '@server/shared/config';
import { contactsApi } from '@server/features/contacts/api';
import { productsApi } from '@server/features/products/api';
import { inventoryApi } from '@server/features/inventory/api';
import { cartApi } from '@server/features/cart/api';
import { favoritesApi } from '@server/features/favorites/api';
import { couponsApi } from '@server/features/coupons/api';
import { ordersApi } from '@server/features/orders/api';
import { dashboardApi } from '@server/features/dashboard/api';
const featureApis = [authApi, accountsApi, contactsApi, productsApi, inventoryApi, cartApi, favoritesApi, couponsApi, ordersApi, dashboardApi];
export async function handleShopRequest(req: Request) {
    try {
        const url = new URL(req.url);
        const parts = url.pathname.replace(/^\/api\/shop\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
        if (parts.length > 2) throw new ShopError('Không tìm thấy chức năng.',404);
        const [area, id] = parts;
        const db = database();
        await ensureCatalog();
        if (req.method !== 'GET') {
            const origin = req.headers.get('origin');
            if ((origin && !config.allowedOrigins.has(origin)) || (req.headers.get('sec-fetch-site') === 'cross-site' && !origin))
                throw new ShopError('Yêu cầu không hợp lệ.', 403);
            if (!req.headers.get('content-type')?.startsWith('application/json'))
                throw new ShopError('Yêu cầu cần dữ liệu JSON.', 415);
        }
        const s = await getSession(req);
        const rawBody = req.method === 'GET' ? {} : await req.json().catch(() => { throw new ShopError('Dữ liệu không hợp lệ.'); });
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody))
            throw new ShopError('Dữ liệu không hợp lệ.');
        const body = rawBody as Record<string, any>;
        const context: ShopRequestContext = { req, url, area, id, db, s, body };
        for (const action of featureApis) {
            const response = await action(context);
            if (response)
                return response;
        }
        throw new ShopError('Không tìm thấy chức năng.', 404);
    }
    catch (error) {
        if (error instanceof ShopError)
            return json({ error: error.message }, error.status);
        console.error('shop request failed', error);
        return json({ error: 'Không thể hoàn thành thao tác. Vui lòng thử lại.' }, 503);
    }
}
