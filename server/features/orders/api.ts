import { ShopError } from '@server/shared/errors';
import { textValue, integerValue } from '@server/shared/validation';
import { orderRow, orderRowWithReviews } from '@server/features/orders/server/serialization';
import { requireRole, allRoles, teamRoles } from '@server/features/accounts/server/session';
import { getCart } from '@server/features/cart/server/cart';
import { findUsableOffer, offerDiscount, reserveOffer } from '@server/features/offers/server/offers';
import { notifyStaff, notifyCustomerOrderStatus } from '@server/features/notifications/hub';
import { addOrderEvent, transitionOrder, type Actor } from '@server/features/orders/server/status';
import { inTransaction } from '@server/shared/transaction';
import { nowIso } from '@server/shared/time';
import { money } from '@server/shared/formatters';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';

const FREE_SHIPPING_FROM = 699000, SHIPPING_FEE = 30000;
const shippingFor = (subtotal: number) => subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

export async function ordersApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, action, db, s, body } = ctx;
    if (area !== 'orders') return undefined;
    const u = requireRole(s, allRoles);
    const actor: Actor = { id: u.id, name: u.name, role: u.role };
    const isTeam = teamRoles.includes(u.role);
    const load = (orderId: string) => db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
    const expectedVersion = body.version === undefined || body.version === null ? undefined : integerValue(body.version, 1, 1000000);

    // Khách chỉ hủy được đơn của mình khi còn "chờ xác nhận"; kiểm tra lại status+version trong cùng transaction.
    async function cancel(orderId: string) {
        const o = load(orderId);
        if (!o) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        if (!isTeam) {
            if (o.customer_id !== u.id || o.status !== 'pending') throw new ShopError('Bạn chỉ có thể hủy đơn của mình khi đang chờ xác nhận.', 403);
        } else if (u.role === 'staff') throw new ShopError('Nhân viên cần quản lý duyệt hủy đơn.', 403);
        const updated = transitionOrder(db, { orderId, next: 'cancelled', actor, note: textValue(body.note, 300) || (isTeam ? 'Cửa hàng hủy đơn' : 'Khách hàng hủy đơn'), expectedVersion, onlyFrom: isTeam ? undefined : 'pending' });
        if (!isTeam) notifyStaff(db, { type: 'order_cancelled', title: 'Khách hủy đơn ' + orderId, body: o.customer_name + ' · ' + money(o.total), link: '/quan-tri?order=' + orderId, ref_key: 'cancel:' + orderId });
        else notifyCustomerOrderStatus(db, { ...o, ...updated }, 'cancelled');
        return updated;
    }

    if (req.method === 'GET') {
        if (id) {
            const o = load(id);
            if (!o || (o.customer_id !== u.id && !isTeam)) throw new ShopError('Không tìm thấy đơn hàng.', 404);
            const eventsRaw = db.prepare('SELECT id,status,note,actor_name,created_at FROM order_events WHERE order_id=? ORDER BY created_at ASC, rowid ASC').bind(id).all().results as any[];
            // Khách không xem mốc nội bộ xác nhận thanh toán.
            const events = u.role === 'customer' ? eventsRaw.filter(e => e.status !== 'paid') : eventsRaw;
            const refund = db.prepare('SELECT id,amount,status,note,created_at,confirmed_at FROM order_refunds WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(id).first();
            const shipment = db.prepare('SELECT provider,tracking_code,status,fee,cod_collected,updated_at FROM shipping_shipments WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(id).first();
            const transactions = db.prepare('SELECT provider,status,amount,created_at FROM payment_transactions WHERE order_id=? ORDER BY created_at DESC LIMIT 10').bind(id).all().results;
            const base = (u.role === 'customer' && o.customer_id === u.id)
                ? orderRowWithReviews(o, new Set(db.prepare('SELECT product_id FROM product_reviews WHERE member_id=?').bind(u.id).all<{ product_id: string }>().results.map(r => r.product_id)))
                : orderRow(o);
            return json({
                ...base, events,
                tracking: { code: o.tracking_code, shipment },
                payment_info: { method: o.payment, status: o.payment_status, transactions },
                refund_info: { status: o.refund_status, refund },
            });
        }
        const manage = url.searchParams.get('manage') === '1';
        if (manage) requireRole(s, teamRoles);
        const stmt = db.prepare('SELECT * FROM orders' + (manage ? '' : ' WHERE customer_id=?') + ' ORDER BY created_at DESC');
        const rows = await (manage ? stmt : stmt.bind(u.id)).all();
        if (manage || isTeam) return json(rows.results.map(orderRow));
        const reviewed = db.prepare('SELECT product_id FROM product_reviews WHERE member_id=?').bind(u.id).all<{ product_id: string }>().results;
        const reviewedSet = new Set(reviewed.map(r => r.product_id));
        return json(rows.results.map(o => orderRowWithReviews(o, reviewedSet)));
    }

    if (req.method === 'PATCH') {
        const o = load(id);
        if (!o) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        const next = textValue(body.status);
        if (next === 'cancelled') { await cancel(id); return json({ ok: true }); }
        if (!isTeam) throw new ShopError('Bạn chỉ có thể hủy đơn của mình khi đang chờ xác nhận.', 403);
        const updated = transitionOrder(db, { orderId: id, next, actor, note: textValue(body.note, 300), expectedVersion, trackingCode: textValue(body.tracking_code, 60) || undefined });
        notifyCustomerOrderStatus(db, { ...o, ...updated }, next);
        return json({ ok: true, status: updated.status, version: updated.version });
    }

    if (req.method === 'POST' && id && action === 'cancel') {
        await cancel(id);
        return json({ ok: true });
    }

    if (req.method === 'POST' && id && action === 'resize') {
        if (u.role !== 'customer') throw new ShopError('Chỉ khách hàng đặt đơn mới có thể đổi size.', 403);
        const variantId = textValue(body.variant_id, 200), newSize = textValue(body.size, 20);
        if (!variantId || !newSize) throw new ShopError('Vui lòng chọn sản phẩm và size mới.');
        const result = inTransaction(db, () => {
            const o = load(id);
            if (!o || o.customer_id !== u.id) throw new ShopError('Không tìm thấy đơn hàng.', 404);
            if (o.status !== 'pending') throw new ShopError('Chỉ đổi được size khi đơn đang chờ xác nhận.', 409);
            if (expectedVersion !== undefined && expectedVersion !== o.version) throw new ShopError('Đơn đã được cập nhật. Vui lòng tải lại.', 409);
            const items: any[] = JSON.parse(o.items);
            const item = items.find(entry => entry.variant_id === variantId);
            if (!item) throw new ShopError('Không tìm thấy sản phẩm trong đơn.', 404);
            if (item.size === newSize) throw new ShopError('Size mới trùng với size hiện tại.');
            const target = db.prepare('SELECT v.id,v.stock,p.price,p.active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND v.size=? AND v.color=?').bind(item.product_id, newSize, item.color).first<any>();
            if (!target || !target.active) throw new ShopError('Size này hiện không có cho sản phẩm.', 409);
            // Trừ kho size mới có điều kiện (atomic), trả kho size cũ.
            if (db.prepare('UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?').bind(item.quantity, target.id, item.quantity).run().meta.changes !== 1) throw new ShopError('Size mới đã hết hàng hoặc không đủ số lượng.', 409);
            db.prepare('UPDATE variants SET stock=stock+? WHERE id=?').bind(item.quantity, item.variant_id).run();
            const oldSize = item.size;
            item.size = newSize; item.variant_id = target.id; item.price = target.price;
            const subtotal = items.reduce((n, entry) => n + entry.price * entry.quantity, 0);
            let discount = 0;
            if (o.offer_id) {
                const offer = db.prepare('SELECT * FROM member_offers WHERE id=? AND member_id=?').bind(o.offer_id, u.id).first<any>();
                if (!offer || subtotal < offer.minimum) throw new ShopError('Đơn sau khi đổi không còn đủ điều kiện dùng mã ưu đãi.', 409);
                discount = offerDiscount(offer, subtotal);
            } else if (o.coupon_code) {
                const coupon = db.prepare('SELECT * FROM coupons WHERE code=?').bind(o.coupon_code).first<any>();
                if (!coupon || subtotal < coupon.minimum) throw new ShopError('Đơn sau khi đổi không còn đủ điều kiện dùng mã ưu đãi.', 409);
                discount = Math.round(subtotal * coupon.percent / 100);
            }
            const shipping = shippingFor(subtotal), total = subtotal - discount + shipping, delta = total - o.total;
            if (o.payment_status === 'paid' && delta !== 0) throw new ShopError('Đơn đã thanh toán, không thể đổi size nếu giá thay đổi. Vui lòng liên hệ cửa hàng.', 409);
            const changed = db.prepare("UPDATE orders SET items=?,subtotal=?,discount=?,shipping=?,total=?,version=version+1 WHERE id=? AND status='pending' AND version=?").bind(JSON.stringify(items), subtotal, discount, shipping, total, id, o.version).run();
            if (changed.meta.changes !== 1) throw new ShopError('Đơn đã được cập nhật bởi người khác.', 409);
            addOrderEvent(db, id, 'pending', `Đổi size ${item.name}: ${oldSize} → ${newSize}` + (delta ? ` (chênh lệch ${delta > 0 ? '+' : ''}${delta}đ)` : ''), actor);
            return { total, price_delta: delta, subtotal, discount, shipping };
        });
        notifyStaff(db, { type: 'order_resized', title: 'Khách đổi size đơn ' + id, link: '/quan-tri?order=' + id, ref_key: `resize:${id}:${Date.now()}` });
        return json({ ok: true, ...result, order: orderRow(load(id)) });
    }

    if (req.method !== 'POST' || id) throw new ShopError('Thao tác không hỗ trợ.', 405);

    // ---- Tạo đơn ----
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
    const snapshot: Record<string, any>[] = [];
    let subtotal = 0;
    for (const item of items) {
        if (!item.product.active || item.quantity > item.stock)
            throw new ShopError('Một sản phẩm đã hết hàng. Vui lòng kiểm tra lại giỏ.');
        subtotal += item.product.price * item.quantity;
        snapshot.push({ product_id: item.product_id, name: item.product.name, image: item.product.image, price: item.product.price, size: item.size, color: item.color, quantity: item.quantity, variant_id: item.variant_id });
    }
    // Chỉ một mã mỗi đơn: mã ưu đãi thành viên (welcome/birthday/anniversary) KHÔNG cộng dồn với coupon thường.
    if (body.coupon && body.offer_code) throw new ShopError('Mỗi đơn chỉ áp dụng một mã ưu đãi.');
    const code = textValue(body.coupon || body.offer_code, 40).toUpperCase();
    let discount = 0, couponCode = '', offerId = '';
    if (code) {
        const offer = findUsableOffer(db, u.id, code, subtotal);
        if (offer) { discount = offer.discount; offerId = offer.id; couponCode = code; }
        else {
            const c = await db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(code).first<any>();
            if (!c || subtotal < c.minimum)
                throw new ShopError('Mã ưu đãi không áp dụng cho đơn này.');
            discount = Math.round(subtotal * c.percent / 100);
            couponCode = code;
        }
    }
    const shipping = shippingFor(subtotal);
    const total = subtotal - discount + shipping;
    const orderId = 'MA-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const created = nowIso();
    try {
        inTransaction(db, () => {
            if (offerId && !reserveOffer(db, offerId, orderId, u.id, created)) throw new ShopError('Mã ưu đãi vừa được sử dụng hoặc đã hết hạn.', 409);
            for (const item of items)
                if (db.prepare('UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?').bind(item.quantity, item.variant_id, item.quantity).run().meta.changes !== 1)
                    throw new ShopError('Sản phẩm vừa thay đổi tồn kho. Vui lòng kiểm tra và thử lại.', 409);
            db.prepare("INSERT INTO orders (id,customer_id,customer_name,phone,address,note,total,subtotal,shipping,discount,status,payment,items,created_at,idempotency_key,coupon_code,offer_id,payment_status,refund_status,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'unpaid','none',1)").bind(orderId, u.id, name, phone, address, textValue(body.note, 1000), total, subtotal, shipping, discount, 'pending', body.payment, JSON.stringify(snapshot), created, key, couponCode, offerId).run();
            addOrderEvent(db, orderId, 'pending', 'Đơn hàng được tạo', actor, created);
            for (const item of items)
                db.prepare('DELETE FROM cart WHERE owner_id=? AND id=? AND quantity=?').bind(u.id, item.id, item.quantity).run();
        });
    }
    catch (error) {
        const again = await db.prepare('SELECT * FROM orders WHERE customer_id=? AND idempotency_key=?').bind(u.id, key).first();
        if (again)
            return json(orderRow(again));
        if (error instanceof ShopError) throw error;
        throw new ShopError('Sản phẩm vừa thay đổi tồn kho. Vui lòng kiểm tra và thử lại.', 409);
    }
    // Thông báo nhân viên không được làm hỏng đơn hàng (notifyStaff tự bắt lỗi).
    try { notifyStaff(db, { type: 'order_new', title: 'Đơn hàng mới ' + orderId, body: `${name} · ${money(total)}`, link: '/quan-tri?order=' + orderId, ref_key: orderId }); } catch { /* bỏ qua */ }
    return json(orderRow(await db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first()));
}
