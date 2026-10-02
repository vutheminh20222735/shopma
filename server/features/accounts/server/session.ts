import { createHash, randomBytes } from 'node:crypto';
import type { Member, Role, Session } from '@server/shared/shop-types';
import { ShopError } from '@server/shared/errors';
import { database } from '@server/shared/database';
import { config } from '@server/shared/config';

export function readCookie(request: Request, name: string) {
    const values = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
    return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function sessionCookie(name: string, value: string, maxAge: number) {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.secureCookie ? '; Secure' : ''}`;
}
export function createSession(memberId: string) {
    const db = database();
    const token = randomBytes(32).toString('hex');
    db.batch([
        db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(Date.now()),
        db.prepare('INSERT INTO auth_sessions (token_hash,member_id,expires_at) VALUES (?,?,?)').bind(hashToken(token), memberId, Date.now() + config.sessionMilliseconds),
    ]);
    return sessionCookie('ma_session', token, Math.floor(config.sessionMilliseconds / 1000));
}
export async function getSession(request: Request): Promise<Session & { actor: Member | null }> {
    const empty = { user: null, actor: null, canPreview: false, preview: false };
    const token = readCookie(request, 'ma_session');
    if (!/^[a-f0-9]{64}$/.test(token)) return empty;
    const db = database();
    const actor = db.prepare('SELECT m.* FROM auth_sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1 AND m.demo=0').bind(hashToken(token), Date.now()).first<Member>();
    if (!actor) return empty;
    const shop = db.prepare("SELECT owner_id FROM shop WHERE id='main'").first<{ owner_id: string }>();
    const canPreview = shop?.owner_id === actor.id && actor.role === 'admin';
    const previewToken = readCookie(request, 'ma_preview');
    if (previewToken && canPreview) {
        const user = db.prepare('SELECT m.* FROM preview_sessions s JOIN members m ON m.id=s.member_id WHERE s.token=? AND s.actor_id=? AND s.expires_at>? AND m.active=1').bind(previewToken, actor.id, Date.now()).first<Member>();
        if (user) return { user, actor, canPreview, preview: true };
    }
    return { user: actor, actor, canPreview, preview: false };
}
export function requireRole(session: Session, roles: Role[]) {
    if (!session.user) throw new ShopError('Vui lòng đăng nhập để tiếp tục.', 401);
    if (!roles.includes(session.user.role)) throw new ShopError('Vai trò của bạn không có quyền thực hiện thao tác này.', 403);
    return session.user;
}
export const allRoles: Role[] = ['admin', 'manager', 'staff', 'customer'];
export const teamRoles: Role[] = ['admin', 'manager', 'staff'];
export const managementRoles: Role[] = ['admin', 'manager'];
