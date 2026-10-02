import type { Settings } from '@server/shared/shop-types';
import { ShopError } from '@server/shared/errors';
import { textValue } from '@server/shared/validation';
import { requireRole } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function contactsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'settings') {
        if (req.method === 'GET') {
            const row = await db.prepare("SELECT phone,zalo,facebook,address,hours FROM shop WHERE id='main'").first();
            return json(row ?? { phone: '', zalo: '', facebook: '', address: '', hours: '09:00 – 21:00, mỗi ngày' });
        }
        requireRole(s, ['admin']);
        const v: Settings = { phone: textValue(body.phone, 20), zalo: textValue(body.zalo, 250), facebook: textValue(body.facebook, 250), address: textValue(body.address, 300), hours: textValue(body.hours, 100) };
        if (v.phone && !/^\+?[\d\s().-]{8,20}$/.test(v.phone))
            throw new ShopError('Số điện thoại chưa đúng định dạng.');
        for (const [key, value] of [['zalo', v.zalo], ['facebook', v.facebook]])
            if (value) {
                let link;
                try {
                    link = new URL(value);
                }
                catch {
                    throw new ShopError('Vui lòng nhập đường dẫn đầy đủ bắt đầu bằng https://.');
                }
                ;
                const hosts = key === 'zalo' ? ['zalo.me'] : ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com'];
                if (link.protocol !== 'https:' || !hosts.includes(link.hostname))
                    throw new ShopError('Đường dẫn ' + key + ' không hợp lệ.');
            }
        await db.prepare("UPDATE shop SET phone=?,zalo=?,facebook=?,address=?,hours=? WHERE id='main'").bind(v.phone, v.zalo, v.facebook, v.address, v.hours).run();
        return json({ ok: true });
    }
    return undefined;
}
