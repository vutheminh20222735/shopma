import { ShopError } from '@server/shared/errors';
import { config } from '@server/shared/config';
import { integerValue, textValue } from '@server/shared/validation';
import { requireRole, allRoles, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { confirmRefund, markOrderPaid, systemActor } from '@server/features/orders/server/status';
import { inTransaction, newId } from '@server/shared/transaction';
import { requireSignedWebhook } from '@server/shared/webhook';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import type { ShopDatabase } from '@database/index';
import type { ShopRequestContext } from '@server/shared/context';

const PROVIDER = 'stub';
const STATUSES = ['paid', 'failed', 'refunded'];

/**
 * Xử lý sự kiện thanh toán đã xác thực chữ ký. Idempotent theo (provider, event_id):
 * gửi lại cùng event_id không thay đổi gì thêm. Chỉ webhook đã ký mới làm đơn "đã thanh toán".
 */
export function processPaymentEvent(db: ShopDatabase, event: Record<string, any>) {
    const provider = textValue(event.provider, 30) || PROVIDER;
    const eventId = textValue(event.event_id, 100), orderId = textValue(event.order_id, 40), status = textValue(event.status, 20);
    if (!eventId || !orderId || !STATUSES.includes(status)) throw new ShopError('Sự kiện thanh toán không hợp lệ.');
    const amount = integerValue(event.amount, 0, 1000000000);
    const result = inTransaction(db, () => {
        const order = db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
        if (!order) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        const now = nowIso();
        const inserted = db.prepare('INSERT OR IGNORE INTO payment_transactions (id,order_id,provider,provider_ref,amount,status,raw,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .bind(newId(), orderId, provider, textValue(event.provider_ref, 100), amount, status, JSON.stringify(event).slice(0, 4000), eventId, now, now).run();
        if (!inserted.meta.changes) return { duplicate: true, mismatch: false };
        const txRow = (state: string) => db.prepare('UPDATE payment_transactions SET status=?,updated_at=? WHERE provider=? AND idempotency_key=?').bind(state, now, provider, eventId).run();
        if (status === 'paid') {
            if (amount !== order.total) { txRow('amount_mismatch'); return { duplicate: false, mismatch: true }; }
            markOrderPaid(db, orderId, systemActor, `Đã nhận thanh toán ${provider} (${textValue(event.provider_ref, 60) || eventId})`);
        } else if (status === 'refunded') {
            if (order.refund_status === 'pending') confirmRefund(db, orderId, systemActor, textValue(event.provider_ref, 100));
        }
        return { duplicate: false, mismatch: false };
    });
    if (result.mismatch) throw new ShopError('Số tiền thanh toán không khớp với đơn hàng.', 422);
    return { ok: true, duplicate: result.duplicate };
}

export async function paymentsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, action, db, s, body, rawBody } = ctx;
    if (area !== 'payments') return undefined;

    // Webhook của cổng thanh toán: không dùng phiên đăng nhập, bắt buộc chữ ký HMAC.
    if (id === 'webhook' && req.method === 'POST') {
        requireSignedWebhook(req, rawBody, config.paymentWebhookSecret);
        return json(processPaymentEvent(db, body));
    }

    // Trang quay lại từ cổng thanh toán: chỉ phản ánh trạng thái đã lưu, KHÔNG BAO GIỜ coi redirect là đã thanh toán.
    if (id === 'return' && req.method === 'GET') {
        const u = requireRole(s, allRoles);
        const orderId = textValue(url.searchParams.get('order'), 40);
        const order = db.prepare('SELECT id,customer_id,payment_status,total FROM orders WHERE id=?').bind(orderId).first<any>();
        if (!order || (order.customer_id !== u.id && !teamRoles.includes(u.role))) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        return json({ order_id: order.id, paid: order.payment_status === 'paid', payment_status: order.payment_status, message: order.payment_status === 'paid' ? 'Đã nhận thanh toán.' : 'Đang chờ xác nhận thanh toán từ ngân hàng. Trạng thái sẽ cập nhật khi hệ thống nhận được xác nhận.' });
    }

    const u = requireRole(s, allRoles);
    const order = id ? db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>() : null;
    if (!order || (order.customer_id !== u.id && !teamRoles.includes(u.role))) throw new ShopError('Không tìm thấy đơn hàng.', 404);

    if (req.method === 'GET' && !action) {
        const transactions = db.prepare('SELECT provider,provider_ref,amount,status,created_at,updated_at FROM payment_transactions WHERE order_id=? ORDER BY created_at DESC').bind(id).all().results;
        const refunds = db.prepare('SELECT amount,status,note,created_at,confirmed_at FROM order_refunds WHERE order_id=? ORDER BY created_at DESC').bind(id).all().results;
        return json({ order_id: id, method: order.payment, payment_status: order.payment_status, refund_status: order.refund_status, total: order.total, live: config.paymentsLive, transactions, refunds });
    }

    if (req.method === 'POST' && action === 'create') {
        if (order.payment !== 'transfer') throw new ShopError('Đơn này thanh toán khi nhận hàng (COD).');
        if (order.payment_status !== 'unpaid' || order.status === 'cancelled') throw new ShopError('Đơn không còn cần thanh toán.', 409);
        if (config.paymentsLive) throw new ShopError('Cổng thanh toán thật chưa được tích hợp trong bản này.', 501);
        const now = nowIso();
        db.prepare('INSERT OR IGNORE INTO payment_transactions (id,order_id,provider,provider_ref,amount,status,raw,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(newId(), id, PROVIDER, 'STUB-' + id, order.total, 'pending', '', 'create:' + id, now, now).run();
        const redirect = `${config.appOrigin}/thanh-toan/ket-qua?order=${encodeURIComponent(id)}`;
        return json({ order_id: id, provider: PROVIDER, status: 'pending', amount: order.total, live: false, redirect_url: redirect, note: 'Chế độ stub (PAYMENTS_LIVE=0): chỉ webhook có chữ ký hợp lệ mới đánh dấu đơn đã thanh toán.' });
    }

    if (req.method === 'POST' && action === 'confirm') {
        const manager = requireRole(s, managementRoles);
        return json(markOrderPaid(db, id, { id: manager.id, name: manager.name, role: manager.role }, textValue(body.note, 200) || 'Quản lý xác nhận đã nhận chuyển khoản'));
    }
    if (req.method === 'POST' && action === 'refund-confirm') {
        const manager = requireRole(s, managementRoles);
        return json(confirmRefund(db, id, { id: manager.id, name: manager.name, role: manager.role }, textValue(body.provider_ref, 100)));
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}
