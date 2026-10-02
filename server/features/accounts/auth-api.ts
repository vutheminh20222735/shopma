import { randomUUID } from 'node:crypto';
import { ShopError } from '@server/shared/errors';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
import { hashPassword, validatePassword, verifyPassword } from './server/passwords';
import { createSession, hashToken, readCookie, sessionCookie } from './server/session';
import { requestPasswordReset, resetPasswordWithToken } from './server/password-reset';
import type { Member } from './types';

function response(data: unknown, cookies: string[] = [], status = 200) {
    const result = json(data, status);
    for (const cookie of cookies) result.headers.append('Set-Cookie', cookie);
    return result;
}
export async function authApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { area, id, req, body, db, s } = ctx;
    if (area !== 'auth') return undefined;
    if (req.method !== 'POST') throw new ShopError('Thao tác không hỗ trợ.', 405);
    if (id === 'logout') {
        const token = readCookie(req, 'ma_session');
        if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(hashToken(token)).run();
        if (s.actor) db.prepare('DELETE FROM preview_sessions WHERE actor_id=?').bind(s.actor.id).run();
        return response({ok:true}, [sessionCookie('ma_session','',0),sessionCookie('ma_preview','',0)]);
    }
    if (id === 'forgot-password') {
        return json(await requestPasswordReset(typeof body.email === 'string' ? body.email : ''));
    }
    if (id === 'reset-password') {
        return json(await resetPasswordWithToken({
            token: typeof body.token === 'string' ? body.token : '',
            email: typeof body.email === 'string' ? body.email : '',
            code: typeof body.code === 'string' ? body.code : '',
            password: body.password,
        }));
    }
    if (!['login','register'].includes(id)) throw new ShopError('Không tìm thấy chức năng.',404);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ShopError('Email không hợp lệ.');
    if (typeof body.password !== 'string' || body.password.length > 128) throw new ShopError('Mật khẩu không hợp lệ.');
    let member: Member | null;
    if (id === 'register') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 100) throw new ShopError('Tên cần từ 2 đến 100 ký tự.');
        const password = validatePassword(body.password);
        if (db.prepare('SELECT id FROM members WHERE email=?').bind(email).first()) throw new ShopError('Email này đã có tài khoản.',409);
        const memberId = randomUUID();
        const hash = await hashPassword(password);
        db.batch([
            db.prepare('INSERT INTO members (id,name,email,role,active,demo) VALUES (?,?,?,\'customer\',1,0)').bind(memberId,name,email),
            db.prepare('INSERT INTO credentials (member_id,password_hash,password_plain) VALUES (?,?,?)').bind(memberId,hash,password),
        ]);
        member = db.prepare('SELECT * FROM members WHERE id=?').bind(memberId).first<Member>();
    } else {
        const record = db.prepare('SELECT m.id,c.password_hash FROM members m JOIN credentials c ON c.member_id=m.id WHERE m.email=? AND m.active=1 AND m.demo=0').bind(email).first<{id:string;password_hash:string}>();
        if (!await verifyPassword(body.password, record?.password_hash)) throw new ShopError('Email hoặc mật khẩu không đúng.',401);
        member = db.prepare('SELECT * FROM members WHERE id=?').bind(record!.id).first<Member>();
    }
    if (!member) throw new ShopError('Không thể đăng nhập.',401);
    // Rotate the current session and clear any role preview on login.
    const oldToken = readCookie(req,'ma_session');
    if (oldToken) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(hashToken(oldToken)).run();
    return response({user:member},[createSession(member.id),sessionCookie('ma_preview','',0)],id==='register'?201:200);
}
