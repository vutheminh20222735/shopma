import { ShopError } from '@server/shared/errors';
import { integerValue } from '@server/shared/validation';
import { requireRole, allRoles } from '@server/features/accounts/server/session';
import { getCart } from '@server/features/cart/server/cart';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function cartApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'cart') {
        const user = requireRole(s, allRoles);
        if (req.method === 'GET')
            return json(await getCart(user.id));
        if (req.method === 'DELETE') {
            await db.prepare('DELETE FROM cart WHERE id=? AND owner_id=?').bind(id, user.id).run();
            return json({ ok: true });
        }
        const qty = integerValue(body.quantity, 1, 20);
        const variant = await db.prepare('SELECT v.*,p.active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND v.size=? AND v.color=?').bind(body.product_id, body.size, body.color).first<any>();
        if (!variant?.active)
            throw new ShopError('Sản phẩm hiện không còn bán.');
        const existing = await db.prepare('SELECT * FROM cart WHERE owner_id=? AND variant_id=?').bind(user.id, variant.id).first<any>();
        const next = req.method === 'PATCH' ? qty : (existing?.quantity || 0) + qty;
        if (next > 20 || next > variant.stock)
            throw new ShopError('Số lượng vượt quá tồn kho của size và màu đã chọn.');
        await db.prepare('INSERT INTO cart (id,owner_id,variant_id,quantity) VALUES (?,?,?,?) ON CONFLICT(owner_id,variant_id) DO UPDATE SET quantity=excluded.quantity').bind(existing?.id || crypto.randomUUID(), user.id, variant.id, next).run();
        return json({ ok: true });
    }
    return undefined;
}
