import { ShopError } from '@server/shared/errors';
import { textValue, integerValue } from '@server/shared/validation';
import { requireRole, allRoles, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import { cleanUserText } from '@server/shared/sanitize';
import { nowIso } from '@server/shared/time';
import { inTransaction, newId } from '@server/shared/transaction';
import { notifyStaff, notifyMember, pushCommentUpdate } from '@server/features/notifications/hub';
import type { ShopRequestContext } from '@server/shared/context';

const PAGE_SIZE = 10;
const maskName = (name: string) => {
    const parts = String(name || 'Khách').trim().split(/\s+/);
    return parts.length < 2 ? parts[0] : parts.slice(0, -1).join(' ') + ' ' + parts[parts.length - 1][0] + '.';
};
const isUniqueError = (error: unknown) => /UNIQUE/i.test(String((error as Error)?.message));

function reviewRow(r: any, viewerId: string, canSeeHidden: boolean) {
    return {
        id: r.id, product_id: r.product_id, rating: r.rating, content: r.hidden && !canSeeHidden ? '' : r.content,
        verified_purchase: !!r.verified_purchase, verified_label: r.verified_purchase ? 'Đã mua hàng' : '',
        author: maskName(r.author_name), created_at: r.created_at, updated_at: r.updated_at, mine: r.member_id === viewerId,
        ...(canSeeHidden ? { hidden: !!r.hidden, hidden_reason: r.hidden_reason } : {}),
    };
}

export async function reviewsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, action, db, s, body } = ctx;

    // ---- Đánh giá: GET products/:id/reviews ----
    if (area === 'products' && action === 'reviews' && req.method === 'GET') {
        const product = db.prepare('SELECT id FROM products WHERE id=?').bind(id).first();
        if (!product) throw new ShopError('Không tìm thấy sản phẩm.', 404);
        const viewer = s.user;
        const canSeeHidden = !!viewer && teamRoles.includes(viewer.role) && url.searchParams.get('include_hidden') === '1';
        const starsParam = url.searchParams.get('stars');
        const stars = starsParam ? integerValue(starsParam, 1, 5) : 0;
        const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
        const summary = db.prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating),0) AS avg FROM product_reviews WHERE product_id=? AND hidden=0').bind(id).first<{ n: number; avg: number }>();
        const dist = db.prepare('SELECT rating, COUNT(*) AS n FROM product_reviews WHERE product_id=? AND hidden=0 GROUP BY rating').bind(id).all<{ rating: number; n: number }>();
        const distribution: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const d of dist.results) distribution[String(d.rating)] = d.n;
        const where = 'r.product_id=?' + (stars ? ' AND r.rating=?' : '') + (canSeeHidden ? '' : ' AND r.hidden=0');
        const values = stars ? [id, stars] : [id];
        const total = db.prepare(`SELECT COUNT(*) AS n FROM product_reviews r WHERE ${where}`).bind(...values).first<{ n: number }>()?.n || 0;
        const rows = db.prepare(`SELECT r.*, COALESCE(m.name,'Khách') AS author_name FROM product_reviews r LEFT JOIN members m ON m.id=r.member_id WHERE ${where} ORDER BY r.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`).bind(...values).all();
        let myReview = null, canReview = false;
        if (viewer) {
            myReview = db.prepare('SELECT * FROM product_reviews WHERE product_id=? AND member_id=?').bind(id, viewer.id).first<any>();
            canReview = !myReview && !!findEligibleOrder(db, viewer.id, id);
        }
        return json({
            average: Math.round(summary!.avg * 10) / 10, count: summary!.n, distribution,
            page, page_size: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            can_review: canReview, my_review_id: myReview?.id || null,
            items: rows.results.map(r => reviewRow(r, viewer?.id || '', canSeeHidden)),
        });
    }

    // ---- Bình luận / hỏi đáp ----
    if (area === 'products' && action === 'comments') {
        const product = db.prepare('SELECT id FROM products WHERE id=?').bind(id).first();
        if (!product) throw new ShopError('Không tìm thấy sản phẩm.', 404);
        if (req.method === 'GET') {
            const canSeeHidden = !!s.user && teamRoles.includes(s.user.role) && url.searchParams.get('include_hidden') === '1';
            const rows = db.prepare(`SELECT c.*, COALESCE(m.name,'Khách') AS author_name, COALESCE(m.role,'customer') AS author_role FROM product_comments c LEFT JOIN members m ON m.id=c.member_id WHERE c.product_id=?${canSeeHidden ? '' : ' AND c.hidden=0'} ORDER BY c.created_at ASC LIMIT 500`).bind(id).all<any>();
            const shape = (c: any) => ({ id: c.id, parent_id: c.parent_id, content: c.hidden && !canSeeHidden ? '' : c.content, is_staff_reply: !!c.is_staff_reply, author: c.is_staff_reply ? 'M&A Shop · ' + c.author_name.split(/\s+/).pop() : maskName(c.author_name), created_at: c.created_at, mine: c.member_id === (s.user?.id || ''), ...(canSeeHidden ? { hidden: !!c.hidden, hidden_reason: c.hidden_reason } : {}) });
            const roots = rows.results.filter(c => !c.parent_id).map(shape).reverse();
            const replies = rows.results.filter(c => c.parent_id).map(shape);
            return json({ items: roots.map(r => ({ ...r, replies: replies.filter(x => x.parent_id === r.id) })), count: rows.results.filter(c => !c.hidden).length });
        }
        if (req.method === 'POST') {
            const u = requireRole(s, allRoles);
            const staffReply = teamRoles.includes(u.role);
            const content = cleanUserText(body.content, { min: 5, max: 1000 });
            let parentId = '';
            let threadAuthorId = '';
            if (body.parent_id) {
                const parent = db.prepare('SELECT * FROM product_comments WHERE id=? AND product_id=?').bind(textValue(body.parent_id, 80), id).first<any>();
                if (!parent || parent.hidden) throw new ShopError('Không tìm thấy câu hỏi cần trả lời.', 404);
                parentId = parent.parent_id || parent.id; // chỉ 1 cấp trả lời
                if (parent.parent_id) {
                    const root = db.prepare('SELECT member_id FROM product_comments WHERE id=?').bind(parent.parent_id).first<{ member_id: string }>();
                    threadAuthorId = root?.member_id || parent.member_id;
                } else threadAuthorId = parent.member_id;
            }
            const recent = db.prepare('SELECT COUNT(*) AS n FROM product_comments WHERE member_id=? AND created_at>?').bind(u.id, new Date(Date.now() - 60000).toISOString()).first<{ n: number }>();
            if ((recent?.n || 0) >= 5) throw new ShopError('Bạn gửi bình luận quá nhanh. Vui lòng thử lại sau ít phút.', 429);
            const commentId = newId();
            db.prepare('INSERT INTO product_comments (id,product_id,member_id,parent_id,content,is_staff_reply,hidden,hidden_reason,created_at) VALUES (?,?,?,?,?,?,0,\'\',?)').bind(commentId, id, u.id, parentId, content, staffReply ? 1 : 0, nowIso()).run();
            const productName = db.prepare('SELECT name FROM products WHERE id=?').bind(id).first<{ name: string }>()?.name || 'sản phẩm';
            const preview = content.length > 80 ? content.slice(0, 77) + '…' : content;
            const link = `/san-pham/${id}#hoi-dap`;
            try {
                if (!staffReply) {
                    // Khách hỏi → báo nhân sự + cập nhật realtime trên màn nhân sự đang mở sản phẩm.
                    notifyStaff(db, {
                        type: 'product_comment',
                        title: parentId ? 'Khách trả lời hỏi đáp' : 'Khách hỏi về sản phẩm',
                        body: `${u.name} · ${productName}: ${preview}`,
                        link,
                        ref_key: `comment:${commentId}`,
                    });
                    const staffIds = db.prepare("SELECT id FROM members WHERE role IN ('admin','manager','staff') AND active=1 AND demo=0").all<{ id: string }>().results.map(r => r.id);
                    pushCommentUpdate(staffIds, id);
                } else if (threadAuthorId && threadAuthorId !== u.id) {
                    // Shop trả lời → báo khách hỏi và cập nhật danh sách hỏi đáp realtime.
                    notifyMember(db, threadAuthorId, {
                        type: 'product_reply',
                        title: 'Shop đã trả lời câu hỏi của bạn',
                        body: `${productName}: ${preview}`,
                        link,
                        ref_key: `reply:${commentId}`,
                    });
                    pushCommentUpdate([threadAuthorId], id);
                }
            } catch { /* không làm hỏng gửi bình luận */ }
            return json({ id: commentId, is_staff_reply: staffReply }, 201);
        }
        throw new ShopError('Thao tác không hỗ trợ.', 405);
    }

    if (area === 'comments') {
        if (req.method !== 'POST' || action !== 'hide' || !id) throw new ShopError('Thao tác không hỗ trợ.', 405);
        const u = requireRole(s, managementRoles);
        const hide = body.hidden !== false;
        const reason = hide ? textValue(body.reason, 300) : '';
        if (hide && reason.length < 3) throw new ShopError('Vui lòng nhập lý do ẩn bình luận.');
        const result = db.prepare('UPDATE product_comments SET hidden=?,hidden_reason=? WHERE id=?').bind(hide ? 1 : 0, reason, id).run();
        if (!result.meta.changes) throw new ShopError('Không tìm thấy bình luận.', 404);
        void u;
        return json({ ok: true, hidden: hide });
    }

    if (area !== 'reviews') return undefined;

    // ---- POST reviews (tạo) ----
    if (!id && req.method === 'POST') {
        const u = requireRole(s, ['customer']);
        const productId = textValue(body.product_id, 80);
        const rating = integerValue(body.rating, 1, 5);
        const content = cleanUserText(body.content, { min: 10, max: 1000 });
        const product = db.prepare('SELECT id FROM products WHERE id=?').bind(productId).first();
        if (!product) throw new ShopError('Không tìm thấy sản phẩm.', 404);
        const reviewId = newId();
        try {
            inTransaction(db, () => {
                const order = findEligibleOrder(db, u.id, productId);
                if (!order) throw new ShopError('Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã giao và thanh toán.', 403);
                const now = nowIso();
                db.prepare('INSERT INTO product_reviews (id,product_id,member_id,order_id,rating,content,verified_purchase,hidden,hidden_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,1,0,\'\',?,?)').bind(reviewId, productId, u.id, order.id, rating, content, now, now).run();
            });
        } catch (error) {
            if (isUniqueError(error)) throw new ShopError('Bạn đã đánh giá sản phẩm này rồi. Hãy chỉnh sửa đánh giá hiện có.', 409);
            throw error;
        }
        return json({ id: reviewId, verified_purchase: true }, 201);
    }

    if (!id) throw new ShopError('Thao tác không hỗ trợ.', 405);

    // ---- PATCH reviews/:id (chủ đánh giá sửa) ----
    if (req.method === 'PATCH' && !action) {
        const u = requireRole(s, ['customer']);
        const review = db.prepare('SELECT * FROM product_reviews WHERE id=?').bind(id).first<any>();
        if (!review) throw new ShopError('Không tìm thấy đánh giá.', 404);
        if (review.member_id !== u.id) throw new ShopError('Bạn chỉ có thể sửa đánh giá của mình.', 403);
        if (review.hidden) throw new ShopError('Đánh giá đang bị ẩn nên không thể chỉnh sửa.', 403);
        const rating = body.rating === undefined ? review.rating : integerValue(body.rating, 1, 5);
        const content = body.content === undefined ? review.content : cleanUserText(body.content, { min: 10, max: 1000 });
        db.prepare('UPDATE product_reviews SET rating=?,content=?,updated_at=? WHERE id=? AND member_id=? AND hidden=0').bind(rating, content, nowIso(), id, u.id).run();
        return json({ ok: true });
    }

    // ---- POST reviews/:id/hide (admin/manager; không đổi rating) ----
    if (req.method === 'POST' && action === 'hide') {
        const u = requireRole(s, managementRoles);
        const hide = body.hidden !== false;
        const reason = textValue(body.reason, 300);
        if (hide && reason.length < 3) throw new ShopError('Vui lòng nhập lý do ẩn đánh giá.');
        inTransaction(db, () => {
            const result = db.prepare('UPDATE product_reviews SET hidden=?,hidden_reason=? WHERE id=?').bind(hide ? 1 : 0, hide ? reason : '', id).run();
            if (!result.meta.changes) throw new ShopError('Không tìm thấy đánh giá.', 404);
            db.prepare('INSERT INTO review_moderation_logs (id,review_id,actor_id,action,reason,created_at) VALUES (?,?,?,?,?,?)').bind(newId(), id, u.id, hide ? 'hide' : 'unhide', reason, nowIso()).run();
        });
        return json({ ok: true, hidden: hide });
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}

/** Đơn đã giao, đã thanh toán (không hoàn tiền toàn bộ) có chứa sản phẩm. */
function findEligibleOrder(db: ShopRequestContext['db'], memberId: string, productId: string): { id: string } | null {
    const rows = db.prepare("SELECT id,items FROM orders WHERE customer_id=? AND status='delivered' AND payment_status='paid' AND refund_status NOT IN ('refunded') ORDER BY created_at DESC").bind(memberId).all<{ id: string; items: string }>();
    for (const row of rows.results) {
        try { if ((JSON.parse(row.items) as any[]).some(item => item.product_id === productId)) return { id: row.id }; } catch { /* bỏ qua dữ liệu lỗi */ }
    }
    return null;
}
