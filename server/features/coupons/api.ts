import { ShopError } from '@server/shared/errors';
import { textValue, integerValue } from '@server/shared/validation';
import { requireRole, allRoles, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function couponsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'coupon' && req.method === 'POST') {
        requireRole(s, allRoles);
        const coupon = await db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(textValue(body.code).toUpperCase()).first();
        if (!coupon)
            throw new ShopError('Mã ưu đãi không hợp lệ hoặc đã hết hiệu lực.');
        return json(coupon);
    }
    if (area === 'coupons') {
        requireRole(s, managementRoles);
        if (req.method === 'GET') {
            const r = await db.prepare('SELECT * FROM coupons').all();
            return json(r.results);
        }
        if (req.method === 'DELETE') {
            await db.prepare('UPDATE coupons SET active=0 WHERE code=?').bind(id).run();
            return json({ ok: true });
        }
        ;
        const code = textValue(body.code, 30).toUpperCase();
        if (!/^[A-Z0-9]{3,30}$/.test(code))
            throw new ShopError('Mã chỉ gồm chữ và số, từ 3 đến 30 ký tự.');
        await db.prepare('INSERT INTO coupons (code,percent,minimum,active) VALUES (?,?,?,1) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,minimum=excluded.minimum,active=1').bind(code, integerValue(body.percent, 1, 50), integerValue(body.minimum || 0, 0, 100000000)).run();
        return json({ ok: true });
    }
    return undefined;
}
