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
import { reviewsApi } from '@server/features/reviews/api';
import { notificationsApi } from '@server/features/notifications/api';
import { offersApi, otpApi } from '@server/features/offers/api';
import { uploadsApi } from '@server/features/products/uploads';
import { reportsApi } from '@server/features/reports/api';
import { paymentsApi } from '@server/features/payments/api';
import { shippingApi } from '@server/features/shipping/api';
import { addressesApi } from '@server/features/addresses/api';
import { bannersApi } from '@server/features/banners/api';
import { giftsApi } from '@server/features/gifts/api';
const featureApis = [authApi, accountsApi, contactsApi, addressesApi, reviewsApi, productsApi, uploadsApi, inventoryApi, cartApi, favoritesApi, couponsApi, offersApi, otpApi, ordersApi, notificationsApi, paymentsApi, shippingApi, reportsApi, dashboardApi, bannersApi, giftsApi];
export async function handleShopRequest(req: Request) {
    try {
        const url = new URL(req.url);
        const parts = url.pathname.replace(/^\/api\/shop\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
        if (parts.length > 3) throw new ShopError('Không tìm thấy chức năng.',404);
        const [area, id, action] = parts;
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
        // Giữ nguyên chuỗi thô để webhook kiểm tra chữ ký HMAC.
        const rawText = req.method === 'GET' ? '' : await req.text();
        const rawBody = req.method === 'GET' ? {} : (() => { try { return JSON.parse(rawText); } catch { throw new ShopError('Dữ liệu không hợp lệ.'); } })();
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody))
            throw new ShopError('Dữ liệu không hợp lệ.');
        const body = rawBody as Record<string, any>;
        const context: ShopRequestContext = { req, url, area, id, action, db, s, body, rawBody: rawText };
        for (const feature of featureApis) {
            const response = await feature(context);
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
