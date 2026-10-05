import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ShopError } from '@server/shared/errors';
import { requireRole, allRoles, getSession } from '@server/features/accounts/server/session';
import { database } from '@server/shared/database';
import { json } from '@server/shared/response';
import { nowIso, parseTime } from '@server/shared/time';
import type { ShopRequestContext } from '@server/shared/context';
import { addClient } from './hub';

export async function notificationsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, action, db, s, body } = ctx;
    if (area !== 'notifications') return undefined;
    const u = requireRole(s, allRoles);
    if (req.method === 'GET') {
        if (id === 'unread-count') {
            const row = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id=? AND read_at IS NULL').bind(u.id).first<{ n: number }>();
            return json({ unread: row?.n || 0 });
        }
        if (id === 'stream') throw new ShopError('Hãy mở kết nối SSE (EventSource) tới đường dẫn này.', 400);
        if (id) throw new ShopError('Không tìm thấy thông báo.', 404);
        const since = url.searchParams.get('since') || '';
        if (since && !Number.isFinite(parseTime(since))) throw new ShopError('Mốc thời gian không hợp lệ.');
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30));
        const unreadOnly = url.searchParams.get('unread') === '1';
        const rows = db.prepare(`SELECT * FROM notifications WHERE member_id=?${since ? ' AND created_at>?' : ''}${unreadOnly ? ' AND read_at IS NULL' : ''} ORDER BY created_at DESC LIMIT ${limit}`)
            .bind(...(since ? [u.id, new Date(parseTime(since)).toISOString()] : [u.id])).all();
        const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id=? AND read_at IS NULL').bind(u.id).first<{ n: number }>();
        return json({ items: rows.results, unread: unread?.n || 0 });
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
        const now = nowIso();
        if (id && id !== 'read' && id !== 'read-all' && (action === 'read' || !action)) {
            const result = db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND member_id=?').bind(now, id, u.id).run();
            if (!result.meta.changes) throw new ShopError('Không tìm thấy thông báo.', 404);
            return json({ ok: true });
        }
        if (id === 'read' || id === 'read-all') {
            if (id === 'read-all' || body.all === true) {
                const result = db.prepare('UPDATE notifications SET read_at=? WHERE member_id=? AND read_at IS NULL').bind(now, u.id).run();
                return json({ ok: true, updated: result.meta.changes });
            }
            const ids = Array.isArray(body.ids) ? body.ids.filter((v: unknown) => typeof v === 'string').slice(0, 100) : [];
            if (!ids.length) throw new ShopError('Chưa chọn thông báo.');
            let updated = 0;
            for (const notificationId of ids)
                updated += db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND member_id=? AND read_at IS NULL').bind(now, notificationId, u.id).run().meta.changes;
            return json({ ok: true, updated });
        }
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}

/** Express handler cho GET /api/shop/notifications/stream — mọi tài khoản đã đăng nhập. */
export async function notificationStream(req: ExpressRequest, res: ExpressResponse) {
    try {
        const headers = new Headers();
        if (typeof req.headers.cookie === 'string') headers.set('cookie', req.headers.cookie);
        const session = await getSession(new Request('http://localhost/', { headers }));
        const user = session.user;
        if (!user) {
            res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
            return;
        }
        res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        res.write('retry: 5000\n\n');
        const unread = database().prepare('SELECT COUNT(*) AS n FROM notifications WHERE member_id=? AND read_at IS NULL').bind(user.id).first<{ n: number }>();
        res.write(`event: ready\ndata: ${JSON.stringify({ unread: unread?.n || 0 })}\n\n`);
        const remove = addClient({ memberId: user.id, write: chunk => { res.write(chunk); } });
        const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* đóng */ } }, 25000);
        heartbeat.unref();
        req.on('close', () => { clearInterval(heartbeat); remove(); });
    } catch (error) {
        console.error('notification stream failed', error);
        if (!res.headersSent) res.status(503).json({ error: 'Không thể mở kết nối thông báo.' });
        else res.end();
    }
}
