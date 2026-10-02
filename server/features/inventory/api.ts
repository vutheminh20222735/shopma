import { ShopError } from '@server/shared/errors';
import { integerValue } from '@server/shared/validation';
import { requireRole, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function inventoryApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'inventory') {
        requireRole(s, teamRoles);
        if (req.method === 'GET') {
            const r = await db.prepare('SELECT v.*,p.name,p.image,p.active FROM variants v JOIN products p ON p.id=v.product_id ORDER BY p.name,v.size,v.color').all();
            return json(r.results);
        }
        requireRole(s, managementRoles);
        if (req.method !== 'PATCH')
            throw new ShopError('Thao tác không hỗ trợ.', 405);
        await db.prepare('UPDATE variants SET stock=? WHERE id=?').bind(integerValue(body.stock, 0, 100000), id).run();
        return json({ ok: true });
    }
    return undefined;
}
