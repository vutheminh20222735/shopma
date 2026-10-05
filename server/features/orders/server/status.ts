import type { ShopDatabase } from '@database/index';
import { ShopError } from '@server/shared/errors';
import { inTransaction, newId } from '@server/shared/transaction';
import { nowIso } from '@server/shared/time';

export type Actor = { id: string; name: string; role: string };
export const systemActor: Actor = { id: 'system', name: 'Hệ thống', role: 'system' };
export const transitions: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['packing', 'cancelled'], packing: ['shipping', 'cancelled'], shipping: ['delivered'], delivered: [], cancelled: [] };

/** Ghi một mốc vào dòng thời gian đơn hàng (gọi trong transaction của nghiệp vụ). */
export function addOrderEvent(db: ShopDatabase, orderId: string, status: string, note: string, actor: Actor, at = nowIso()) {
    db.prepare('INSERT INTO order_events (id,order_id,status,note,actor_id,actor_name,created_at) VALUES (?,?,?,?,?,?,?)').bind(newId(), orderId, status, note.slice(0, 500), actor.id, actor.name, at).run();
}

export type TransitionInput = { orderId: string; next: string; actor: Actor; note?: string; expectedVersion?: number; trackingCode?: string; requireOwner?: string; onlyFrom?: string };

/**
 * Đổi trạng thái đơn trong một BEGIN IMMEDIATE: đọc lại trạng thái + version, kiểm tra luồng,
 * cập nhật có điều kiện (status+version), hoàn kho/ưu đãi khi hủy, tạo yêu cầu hoàn tiền nếu đã thanh toán.
 * Hai yêu cầu đồng thời (xác nhận vs hủy) chỉ một bên thắng; bên còn lại nhận 409.
 */
export function transitionOrder(db: ShopDatabase, input: TransitionInput) {
    const { orderId, next, actor } = input;
    return inTransaction(db, () => {
        const o = db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
        if (!o) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        if (input.requireOwner && o.customer_id !== input.requireOwner) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        if (input.expectedVersion !== undefined && input.expectedVersion !== o.version) throw new ShopError('Đơn đã được cập nhật bởi người khác. Vui lòng tải lại.', 409);
        if (input.onlyFrom && o.status !== input.onlyFrom) throw new ShopError('Đơn đã được xử lý nên không thể thực hiện thao tác này. Vui lòng tải lại.', 409);
        if (!transitions[o.status]?.includes(next)) throw new ShopError('Đơn đã đổi trạng thái. Vui lòng tải lại.', 409);
        const now = nowIso();
        const sets = ['status=?', 'version=version+1'];
        const values: (string | number)[] = [next];
        if (next === 'confirmed') { sets.push('confirmed_at=?'); values.push(now); }
        if (input.trackingCode) { sets.push('tracking_code=?'); values.push(input.trackingCode.slice(0, 60)); }
        // COD: tiền thu khi giao thành công. Chuyển khoản chỉ "đã thanh toán" khi nhận webhook/xác nhận thủ công.
        if (next === 'delivered' && o.payment === 'cod' && o.payment_status === 'unpaid') sets.push("payment_status='paid'");
        const result = db.prepare(`UPDATE orders SET ${sets.join(',')} WHERE id=? AND status=? AND version=?`).bind(...values, orderId, o.status, o.version).run();
        if (!result.meta.changes) throw new ShopError('Đơn đã được cập nhật bởi người khác.', 409);
        let note = input.note || '';
        if (next === 'cancelled') {
            for (const item of JSON.parse(o.items)) db.prepare('UPDATE variants SET stock=stock+? WHERE id=?').bind(item.quantity, item.variant_id).run();
            if (o.offer_id) db.prepare("UPDATE member_offers SET used_at=NULL,reserved_order_id='' WHERE id=? AND reserved_order_id=?").bind(o.offer_id, orderId).run();
        }
        addOrderEvent(db, orderId, next, note, actor, now);
        if (next === 'cancelled' && o.payment_status === 'paid' && o.refund_status === 'none') {
            db.prepare("INSERT INTO order_refunds (id,order_id,amount,status,provider_ref,note,created_at,confirmed_at) VALUES (?,?,?,'pending','',?,?,NULL)").bind(newId(), orderId, o.total, 'Hoàn tiền do hủy đơn', now).run();
            db.prepare("UPDATE orders SET refund_status='pending' WHERE id=?").bind(orderId).run();
            addOrderEvent(db, orderId, 'refund_pending', 'Chờ xác nhận hoàn tiền ' + o.total + 'đ', systemActor, now);
        }
        return db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
    });
}

/** Xác nhận đã hoàn tiền (thủ công bởi quản lý hoặc qua webhook). Idempotent. */
export function confirmRefund(db: ShopDatabase, orderId: string, actor: Actor, providerRef = '') {
    return inTransaction(db, () => {
        const o = db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
        if (!o) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        if (o.refund_status === 'refunded') return { ok: true, already: true };
        const refund = db.prepare("SELECT * FROM order_refunds WHERE order_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1").bind(orderId).first<any>();
        if (!refund) throw new ShopError('Đơn này không có yêu cầu hoàn tiền đang chờ.', 409);
        const now = nowIso();
        db.prepare("UPDATE order_refunds SET status='confirmed',confirmed_at=?,provider_ref=? WHERE id=? AND status='pending'").bind(now, providerRef.slice(0, 100), refund.id).run();
        db.prepare("UPDATE orders SET refund_status='refunded',payment_status='refunded',version=version+1 WHERE id=?").bind(orderId).run();
        addOrderEvent(db, orderId, 'refund_confirmed', 'Đã hoàn tiền ' + refund.amount + 'đ', actor, now);
        return { ok: true, already: false, amount: refund.amount };
    });
}

/** Ghi nhận thanh toán thành công (webhook/xác nhận thủ công). Đơn đã hủy nhưng nhận tiền -> mở yêu cầu hoàn. */
export function markOrderPaid(db: ShopDatabase, orderId: string, actor: Actor, note: string) {
    return inTransaction(db, () => {
        const o = db.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
        if (!o) throw new ShopError('Không tìm thấy đơn hàng.', 404);
        if (o.payment_status !== 'unpaid') return { ok: true, already: true };
        const now = nowIso();
        db.prepare("UPDATE orders SET payment_status='paid',version=version+1 WHERE id=? AND payment_status='unpaid'").bind(orderId).run();
        addOrderEvent(db, orderId, 'paid', note, actor, now);
        if (o.status === 'cancelled') {
            db.prepare("INSERT INTO order_refunds (id,order_id,amount,status,provider_ref,note,created_at,confirmed_at) VALUES (?,?,?,'pending','',?,?,NULL)").bind(newId(), orderId, o.total, 'Nhận tiền sau khi đơn đã hủy', now).run();
            db.prepare("UPDATE orders SET refund_status='pending' WHERE id=?").bind(orderId).run();
            addOrderEvent(db, orderId, 'refund_pending', 'Chờ hoàn tiền do đơn đã hủy', systemActor, now);
        }
        return { ok: true, already: false };
    });
}
