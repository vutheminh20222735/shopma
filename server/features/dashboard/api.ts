import { orderRow } from '@server/features/orders/server/serialization';
import { requireRole, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function dashboardApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'dashboard' && req.method === 'GET') {
        requireRole(s, managementRoles);
        const rows = await db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
        const list = rows.results.map(orderRow);
        const revenue = list.filter(o => o.status === 'delivered').reduce((n, o) => n + o.total, 0);
        const low = await db.prepare('SELECT COUNT(*) as n FROM variants v JOIN products p ON p.id=v.product_id WHERE v.stock<=3 AND p.active=1').first<{
            n: number;
        }>();
        return json({ revenue, totalOrders: list.length, pending: list.filter(o => o.status === 'pending').length, lowStock: low?.n || 0, orders: list });
    }
    return undefined;
}
