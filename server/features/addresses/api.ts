import { ShopError } from '@server/shared/errors';
import { textValue } from '@server/shared/validation';
import { requireRole, allRoles } from '@server/features/accounts/server/session';
import { inTransaction, newId } from '@server/shared/transaction';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';

const MAX_ADDRESSES = 10;

function validateAddress(body: Record<string, any>) {
    const recipient_name = textValue(body.recipient_name ?? body.customer_name, 100);
    const phone = textValue(body.phone, 20);
    const address = textValue(body.address, 500);
    const label = textValue(body.label ?? '', 40);
    if (recipient_name.length < 2) throw new ShopError('Họ tên người nhận cần ít nhất 2 ký tự.');
    if (!/^\+?[\d\s().-]{8,20}$/.test(phone)) throw new ShopError('Số điện thoại nhận hàng không hợp lệ.');
    if (address.length < 10) throw new ShopError('Địa chỉ cần ghi rõ số nhà, đường, phường/xã, tỉnh/thành.');
    return { recipient_name, phone, address, label };
}

function addressRow(r: any) {
    return {
        id: r.id,
        label: r.label || '',
        recipient_name: r.recipient_name,
        phone: r.phone,
        address: r.address,
        is_default: !!r.is_default,
        created_at: r.created_at,
        updated_at: r.updated_at,
    };
}

export async function addressesApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, area, id, action, db, s, body } = ctx;
    if (area !== 'addresses') return undefined;
    const u = requireRole(s, allRoles);

    if (req.method === 'GET' && !id) {
        const rows = db.prepare('SELECT * FROM member_addresses WHERE member_id=? ORDER BY is_default DESC, updated_at DESC').bind(u.id).all().results;
        return json(rows.map(addressRow));
    }

    if (req.method === 'POST' && !id) {
        const data = validateAddress(body);
        const count = db.prepare('SELECT COUNT(*) AS n FROM member_addresses WHERE member_id=?').bind(u.id).first<{ n: number }>()!.n;
        if (count >= MAX_ADDRESSES) throw new ShopError(`Bạn chỉ có thể lưu tối đa ${MAX_ADDRESSES} địa chỉ.`);
        const makeDefault = body.is_default === true || count === 0;
        const now = nowIso();
        const addressId = newId();
        inTransaction(db, () => {
            if (makeDefault) db.prepare('UPDATE member_addresses SET is_default=0 WHERE member_id=?').bind(u.id).run();
            db.prepare('INSERT INTO member_addresses (id,member_id,label,recipient_name,phone,address,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
                .bind(addressId, u.id, data.label, data.recipient_name, data.phone, data.address, makeDefault ? 1 : 0, now, now).run();
        });
        return json(addressRow(db.prepare('SELECT * FROM member_addresses WHERE id=?').bind(addressId).first()), 201);
    }

    if (req.method === 'PATCH' && id) {
        const current = db.prepare('SELECT * FROM member_addresses WHERE id=? AND member_id=?').bind(id, u.id).first<any>();
        if (!current) throw new ShopError('Không tìm thấy địa chỉ.', 404);
        const data = validateAddress({
            recipient_name: body.recipient_name ?? current.recipient_name,
            phone: body.phone ?? current.phone,
            address: body.address ?? current.address,
            label: body.label !== undefined ? body.label : current.label,
        });
        const now = nowIso();
        inTransaction(db, () => {
            if (body.is_default === true) db.prepare('UPDATE member_addresses SET is_default=0 WHERE member_id=?').bind(u.id).run();
            const isDefault = body.is_default === true ? 1 : body.is_default === false ? 0 : current.is_default;
            db.prepare('UPDATE member_addresses SET label=?,recipient_name=?,phone=?,address=?,is_default=?,updated_at=? WHERE id=? AND member_id=?')
                .bind(data.label, data.recipient_name, data.phone, data.address, isDefault, now, id, u.id).run();
            if (!isDefault) {
                const hasDefault = db.prepare('SELECT id FROM member_addresses WHERE member_id=? AND is_default=1').bind(u.id).first();
                if (!hasDefault) {
                    const first = db.prepare('SELECT id FROM member_addresses WHERE member_id=? ORDER BY updated_at DESC').bind(u.id).first<{ id: string }>();
                    if (first) db.prepare('UPDATE member_addresses SET is_default=1 WHERE id=?').bind(first.id).run();
                }
            }
        });
        return json(addressRow(db.prepare('SELECT * FROM member_addresses WHERE id=?').bind(id).first()));
    }

    if (req.method === 'POST' && id && action === 'default') {
        const current = db.prepare('SELECT id FROM member_addresses WHERE id=? AND member_id=?').bind(id, u.id).first();
        if (!current) throw new ShopError('Không tìm thấy địa chỉ.', 404);
        inTransaction(db, () => {
            db.prepare('UPDATE member_addresses SET is_default=0 WHERE member_id=?').bind(u.id).run();
            db.prepare('UPDATE member_addresses SET is_default=1,updated_at=? WHERE id=?').bind(nowIso(), id).run();
        });
        return json({ ok: true });
    }

    if (req.method === 'DELETE' && id) {
        const current = db.prepare('SELECT * FROM member_addresses WHERE id=? AND member_id=?').bind(id, u.id).first<any>();
        if (!current) throw new ShopError('Không tìm thấy địa chỉ.', 404);
        inTransaction(db, () => {
            db.prepare('DELETE FROM member_addresses WHERE id=? AND member_id=?').bind(id, u.id).run();
            if (current.is_default) {
                const next = db.prepare('SELECT id FROM member_addresses WHERE member_id=? ORDER BY updated_at DESC').bind(u.id).first<{ id: string }>();
                if (next) db.prepare('UPDATE member_addresses SET is_default=1 WHERE id=?').bind(next.id).run();
            }
        });
        return json({ ok: true });
    }

    throw new ShopError('Thao tác không hỗ trợ.', 405);
}
