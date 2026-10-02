import { ShopError } from '@server/shared/errors';
import { textValue } from '@server/shared/validation';
import { orderRow } from '@server/features/orders/server/serialization';
import { requireRole, allRoles, teamRoles } from '@server/features/accounts/server/session';
import { getCart } from '@server/features/cart/server/cart';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function ordersApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'orders') {
        const u = requireRole(s, allRoles);
        if (req.method === 'GET') {
            const manage = url.searchParams.get('manage') === '1';
            if (manage)
                requireRole(s, teamRoles);
            const stmt = db.prepare('SELECT * FROM orders' + (manage ? '' : ' WHERE customer_id=?') + ' ORDER BY created_at DESC');
            const rows = await (manage ? stmt : stmt.bind(u.id)).all();
            return json(rows.results.map(orderRow));
        }
        if (req.method === 'PATCH') {
            const o = await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();
            if (!o)
                throw new ShopError('Không tìm thấy đơn hàng.', 404);
            const own = o.customer_id === u.id;
            const next = textValue(body.status);
            const transitions: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['packing', 'cancelled'], packing: ['shipping', 'cancelled'], shipping: ['delivered'], delivered: [], cancelled: [] };
            if (!teamRoles.includes(u.role)) {
                if (!own || o.status !== 'pending' || next !== 'cancelled')
                    throw new ShopError('Bạn chỉ có thể hủy đơn của mình khi đang chờ xác nhận.', 403);
            }
            if (next === 'cancelled' && u.role === 'staff')
                throw new ShopError('Nhân viên cần quản lý duyệt hủy đơn.', 403);
            if (!transitions[o.status]?.includes(next))
                throw new ShopError('Đơn đã đổi trạng thái. Vui lòng tải lại.', 409);
            const statements = [];
            if (next === 'cancelled')
                for (const item of JSON.parse(o.items))
                    statements.push(db.prepare('UPDATE variants SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status=?)').bind(item.quantity, item.variant_id, id, o.status));
            statements.push(db.prepare('UPDATE orders SET status=? WHERE id=? AND status=?').bind(next, id, o.status));
            const result = await db.batch(statements);
            if (!result[result.length - 1].meta.changes)
                throw new ShopError('Đơn đã được cập nhật bởi người khác.', 409);
            return json({ ok: true });
        }
        if (req.method !== 'POST')
            throw new ShopError('Thao tác không hỗ trợ.', 405);
        const key = textValue(body.idempotency_key, 80);
        if (key.length < 16)
            throw new ShopError('Yêu cầu đặt hàng không hợp lệ.');
        const prior = await db.prepare('SELECT * FROM orders WHERE customer_id=? AND idempotency_key=?').bind(u.id, key).first();
        if (prior)
            return json(orderRow(prior));
        const name = textValue(body.customer_name, 100), phone = textValue(body.phone, 20), address = textValue(body.address, 500);
        if (name.length < 2 || !/^\+?[\d\s().-]{8,20}$/.test(phone) || address.length < 10)
            throw new ShopError('Vui lòng điền tên, số điện thoại và địa chỉ nhận hàng đầy đủ.');
        if (!['cod', 'transfer'].includes(body.payment))
            throw new ShopError('Phương thức thanh toán không hợp lệ.');
        const items = await getCart(u.id);
        if (!items.length)
            throw new ShopError('Giỏ hàng đang trống.');
        const snapshot = [];
        let subtotal = 0;
        for (const item of items) {
            if (!item.product.active || item.quantity > item.stock)
                throw new ShopError('Một sản phẩm đã hết hàng. Vui lòng kiểm tra lại giỏ.');
            subtotal += item.product.price * item.quantity;
            snapshot.push({ product_id: item.product_id, name: item.product.name, image: item.product.image, price: item.product.price, size: item.size, color: item.color, quantity: item.quantity, variant_id: item.variant_id });
        }
        let discount = 0;
        if (body.coupon) {
            const c = await db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(textValue(body.coupon).toUpperCase()).first<any>();
            if (!c || subtotal < c.minimum)
                throw new ShopError('Mã ưu đãi không áp dụng cho đơn này.');
            discount = Math.round(subtotal * c.percent / 100);
        }
        const shipping = subtotal >= 699000 ? 0 : 30000;
        const total = subtotal - discount + shipping;
        const orderId = 'MA-' + crypto.randomUUID().slice(0, 8).toUpperCase();
        const created = new Date().toISOString();
        const stmts = items.map(item => db.prepare('UPDATE variants SET stock=stock-? WHERE id=?').bind(item.quantity, item.variant_id));
        stmts.push(db.prepare('INSERT INTO orders (id,customer_id,customer_name,phone,address,note,total,subtotal,shipping,discount,status,payment,items,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(orderId, u.id, name, phone, address, textValue(body.note, 1000), total, subtotal, shipping, discount, 'pending', body.payment, JSON.stringify(snapshot), created, key));
        for (const item of items)
            stmts.push(db.prepare('DELETE FROM cart WHERE owner_id=? AND id=? AND quantity=?').bind(u.id, item.id, item.quantity));
        try {
            await db.batch(stmts);
        }
        catch (error) {
            const again = await db.prepare('SELECT * FROM orders WHERE customer_id=? AND idempotency_key=?').bind(u.id, key).first();
            if (again)
                return json(orderRow(again));
            throw new ShopError('Sản phẩm vừa thay đổi tồn kho. Vui lòng kiểm tra và thử lại.', 409);
        }
        return json(orderRow(await db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first()));
    }
    return undefined;
}
