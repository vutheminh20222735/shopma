import { ShopError } from '@server/shared/errors';
import { requireRole, allRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function favoritesApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'favorites') {
        const u = requireRole(s, allRoles);
        if (req.method === 'GET') {
            const rows = await db.prepare('SELECT product_id FROM favorites WHERE owner_id=?').bind(u.id).all<{
                product_id: string;
            }>();
            return json(rows.results.map(v => v.product_id));
        }
        if (req.method === 'DELETE')
            await db.prepare('DELETE FROM favorites WHERE owner_id=? AND product_id=?').bind(u.id, id).run();
        else {
            const p = await db.prepare('SELECT id FROM products WHERE id=? AND active=1').bind(id).first();
            if (!p)
                throw new ShopError('Không tìm thấy sản phẩm.', 404);
            await db.prepare('INSERT OR IGNORE INTO favorites (id,owner_id,product_id) VALUES (?,?,?)').bind(crypto.randomUUID(), u.id, id).run();
        }
        ;
        return json({ ok: true });
    }
    return undefined;
}
