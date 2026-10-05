import { randomInt } from 'node:crypto';
import { ShopError } from '@server/shared/errors';
import { config } from '@server/shared/config';
import { textValue } from '@server/shared/validation';
import { requireRole, allRoles, teamRoles } from '@server/features/accounts/server/session';
import { addOrderEvent, systemActor, transitionOrder } from '@server/features/orders/server/status';
import { inTransaction, newId } from '@server/shared/transaction';
import { requireSignedWebhook } from '@server/shared/webhook';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';

const PROVIDER = 'stub';
const rank: Record<string, number> = { created: 0, picked_up: 1, in_transit: 2, delivered: 3, returned: 3, failed: 3 };

export async function shippingApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, area, id, action, db, s, body, rawBody } = ctx;
    if (area !== 'shipping') return undefined;

    // Webhook đơn vị vận chuyển: chữ ký HMAC, idempotent (cùng trạng thái gửi lại là bỏ qua, không lùi trạng thái).
    if (id === 'webhook' && req.method === 'POST') {
        requireSignedWebhook(req, rawBody, config.shippingWebhookSecret);
        const tracking = textValue(body.tracking_code, 60), status = textValue(body.status, 20);
        if (!tracking || !(status in rank) || status === 'created') throw new ShopError('Sự kiện vận chuyển không hợp lệ.');
        const result = inTransaction(db, () => {
            const shipment = db.prepare('SELECT * FROM shipping_shipments WHERE tracking_code=?').bind(tracking).first<any>();
            if (!shipment) throw new ShopError('Không tìm thấy vận đơn.', 404);
            if (rank[status] < rank[shipment.status] || status === shipment.status || (rank[shipment.status] >= 3)) return { ok: true, ignored: true };
            const now = nowIso();
            const cod = status === 'delivered' ? Math.max(0, Math.trunc(Number(body.cod_collected) || 0)) : shipment.cod_collected;
            db.prepare('UPDATE shipping_shipments SET status=?,cod_collected=?,raw=?,updated_at=? WHERE id=?').bind(status, cod, JSON.stringify(body).slice(0, 4000), now, shipment.id).run();
            const order = db.prepare('SELECT * FROM orders WHERE id=?').bind(shipment.order_id).first<any>();
            if (order) {
                if (['picked_up', 'in_transit', 'delivered'].includes(status) && order.status === 'packing')
                    transitionOrder(db, { orderId: order.id, next: 'shipping', actor: systemActor, note: 'Đơn vị vận chuyển đã nhận hàng' });
                const current = db.prepare('SELECT status FROM orders WHERE id=?').bind(order.id).first<{ status: string }>()!.status;
                if (status === 'delivered' && current === 'shipping') transitionOrder(db, { orderId: order.id, next: 'delivered', actor: systemActor, note: 'Giao hàng thành công' + (cod ? ` · COD thu ${cod}đ` : '') });
                else if (['returned', 'failed'].includes(status)) addOrderEvent(db, order.id, current, status === 'returned' ? 'Đơn bị hoàn về cửa hàng' : 'Giao hàng thất bại', systemActor, now);
            }
            return { ok: true, ignored: false };
        });
        return json(result);
    }

    const u = requireRole(s, allRoles);
    const order = id ? db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>() : null;
    if (!order || (order.customer_id !== u.id && !teamRoles.includes(u.role))) throw new ShopError('Không tìm thấy đơn hàng.', 404);

    if (req.method === 'GET' && !action) {
        const shipment = db.prepare('SELECT provider,tracking_code,status,fee,cod_collected,created_at,updated_at FROM shipping_shipments WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(id).first();
        return json({ order_id: id, tracking_code: order.tracking_code, shipment });
    }

    // Tạo vận đơn (stub): nhân sự cửa hàng, khi đơn đang đóng gói/giao.
    if (req.method === 'POST' && action === 'create') {
        requireRole(s, teamRoles);
        const result = inTransaction(db, () => {
            const o = db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();
            const existing = db.prepare('SELECT * FROM shipping_shipments WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(id).first<any>();
            if (existing) return existing;
            if (!['packing', 'shipping'].includes(o.status)) throw new ShopError('Chỉ tạo vận đơn khi đơn đang đóng gói hoặc đang giao.', 409);
            const now = nowIso();
            const tracking = 'MA' + String(randomInt(0, 1e9)).padStart(9, '0');
            const row = { id: newId(), order_id: id, provider: PROVIDER, tracking_code: tracking, status: 'created', fee: o.shipping, cod_collected: 0 };
            db.prepare("INSERT INTO shipping_shipments (id,order_id,provider,tracking_code,status,fee,cod_collected,raw,created_at,updated_at) VALUES (?,?,?,?,?,?,0,'',?,?)").bind(row.id, id, PROVIDER, tracking, 'created', o.shipping, now, now).run();
            db.prepare('UPDATE orders SET tracking_code=?,version=version+1 WHERE id=?').bind(tracking, id).run();
            addOrderEvent(db, id, o.status, 'Tạo vận đơn ' + tracking, { id: u.id, name: u.name, role: u.role }, now);
            return row;
        });
        return json({ ok: true, shipment: result, live: false }, 201);
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}
