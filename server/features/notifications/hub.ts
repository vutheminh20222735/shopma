import type { ShopDatabase } from '@database/index';
import { nowIso } from '@server/shared/time';

export type NoticePayload = { type: string; title: string; body?: string; link?: string; ref_key: string };
type Client = { memberId: string; write: (chunk: string) => void };
const clients = new Set<Client>();
export const addClient = (client: Client) => { clients.add(client); return () => { clients.delete(client); }; };
export const clientCount = () => clients.size;
export function broadcastTo(memberId: string, event: string, data: unknown) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
        if (client.memberId !== memberId) continue;
        try { client.write(frame); } catch { clients.delete(client); }
    }
}

/**
 * Tạo thông báo cho mọi nhân sự đang hoạt động (admin/manager/staff) rồi đẩy qua SSE.
 * Khóa duy nhất (member_id,type,ref_key): gọi lại với cùng ref_key (vd. mã đơn) không tạo bản sao.
 * Không bao giờ ném lỗi ra ngoài: lỗi thông báo không được làm hỏng nghiệp vụ.
 */
export function notifyStaff(db: ShopDatabase, payload: NoticePayload): number {
    let created = 0;
    try {
        const refKey = payload.ref_key || crypto.randomUUID();
        const staff = db.prepare("SELECT id FROM members WHERE role IN ('admin','manager','staff') AND active=1 AND demo=0").all<{ id: string }>().results;
        for (const member of staff) {
            try {
                const id = crypto.randomUUID();
                const createdAt = nowIso();
                const result = db.prepare('INSERT OR IGNORE INTO notifications (id,member_id,type,title,body,link,ref_key,read_at,created_at) VALUES (?,?,?,?,?,?,?,NULL,?)')
                    .bind(id, member.id, payload.type, payload.title.slice(0, 200), (payload.body || '').slice(0, 500), payload.link || '', refKey, createdAt).run();
                if (!result.meta.changes) continue;
                created++;
                broadcastTo(member.id, 'notification', { id, type: payload.type, title: payload.title, body: payload.body || '', link: payload.link || '', ref_key: refKey, read_at: null, created_at: createdAt });
            } catch (error) {
                if (!/UNIQUE|constraint/i.test(String((error as Error)?.message))) console.error('notifyStaff member failed', error);
            }
        }
    } catch (error) { console.error('notifyStaff failed', error); }
    return created;
}

/** Thông báo + SSE cho một thành viên (khách). Không ném lỗi ra ngoài. */
export function notifyMember(db: ShopDatabase, memberId: string, payload: NoticePayload): boolean {
    if (!memberId) return false;
    try {
        const refKey = payload.ref_key || crypto.randomUUID();
        const id = crypto.randomUUID();
        const createdAt = nowIso();
        const result = db.prepare('INSERT OR IGNORE INTO notifications (id,member_id,type,title,body,link,ref_key,read_at,created_at) VALUES (?,?,?,?,?,?,?,NULL,?)')
            .bind(id, memberId, payload.type, payload.title.slice(0, 200), (payload.body || '').slice(0, 500), payload.link || '', refKey, createdAt).run();
        if (!result.meta.changes) return false;
        broadcastTo(memberId, 'notification', { id, type: payload.type, title: payload.title, body: payload.body || '', link: payload.link || '', ref_key: refKey, read_at: null, created_at: createdAt });
        return true;
    } catch (error) {
        if (!/UNIQUE|constraint/i.test(String((error as Error)?.message))) console.error('notifyMember failed', error);
        return false;
    }
}

/** Đẩy cập nhật hỏi đáp realtime (không lưu DB). */
export function pushCommentUpdate(memberIds: string[], productId: string) {
    const unique = [...new Set(memberIds.filter(Boolean))];
    for (const memberId of unique) {
        try { broadcastTo(memberId, 'comment_update', { product_id: productId }); }
        catch (error) { console.error('pushCommentUpdate failed', error); }
    }
}

/** Đẩy cập nhật trạng thái đơn realtime tới khách (không lưu DB). */
export function pushOrderUpdate(memberId: string, order: { id: string; status: string; version?: number; payment_status?: string; refund_status?: string }) {
    if (!memberId) return;
    try {
        broadcastTo(memberId, 'order_update', {
            id: order.id,
            status: order.status,
            version: order.version,
            payment_status: order.payment_status,
            refund_status: order.refund_status,
        });
    } catch (error) { console.error('pushOrderUpdate failed', error); }
}

const customerStatusTitles: Record<string, string> = {
    confirmed: 'Đã xác nhận đơn hàng',
    packing: 'Đơn hàng đang được chuẩn bị',
    shipping: 'Đơn hàng đang giao',
    delivered: 'Đơn hàng đã giao thành công',
    cancelled: 'Đơn hàng đã được hủy',
};

/** Thông báo + realtime khi trạng thái đơn đổi (gọi sau transition thành công). */
export function notifyCustomerOrderStatus(db: ShopDatabase, order: any, next: string) {
    try {
        const customerId = order?.customer_id;
        if (!customerId) return;
        const title = customerStatusTitles[next] || ('Cập nhật đơn ' + order.id);
        const body = `Đơn ${order.id}` + (next === 'confirmed' ? ' đã được cửa hàng xác nhận.' : ' · trạng thái mới.');
        notifyMember(db, customerId, {
            type: 'order_status',
            title,
            body,
            link: '/tai-khoan?order=' + order.id,
            ref_key: `order:${order.id}:${next}`,
        });
        pushOrderUpdate(customerId, {
            id: order.id,
            status: next,
            version: order.version,
            payment_status: order.payment_status,
            refund_status: order.refund_status,
        });
    } catch (error) { console.error('notifyCustomerOrderStatus failed', error); }
}
