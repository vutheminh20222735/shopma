import type { Member, Role } from '@server/shared/shop-types';
import { ShopError } from '@server/shared/errors';
import { textValue } from '@server/shared/validation';
import { requireRole, allRoles, sessionCookie } from '@server/features/accounts/server/session';
import { hashPassword, validatePassword } from '@server/features/accounts/server/passwords';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
import { grantWelcome, normalizePhone } from '@server/features/offers/server/offers';
import { isYmd, nowIso, todayYmd } from '@server/shared/time';
export async function accountsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'session' && req.method === 'GET')
        return json({ user: s.user, canPreview: s.canPreview, preview: s.preview });
    if (area === 'preview' && req.method === 'POST') {
        if (!s.canPreview || !s.actor)
            throw new ShopError('Chỉ chủ shop có thể thử các vai trò.', 403);
        if (body.role === 'exit')
            return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('ma_preview','',0) });
        if (!allRoles.includes(body.role))
            throw new ShopError('Vai trò không hợp lệ.');
        const member = 'demo-' + body.role;
        const names: Record<Role, string> = { admin: 'Chủ shop mẫu', manager: 'An · Quản lý', staff: 'Mai · Nhân viên', customer: 'Khách hàng mẫu' };
        await db.prepare('INSERT OR IGNORE INTO members (id,name,email,role,active,demo) VALUES (?,?,?,?,1,1)').bind(member, names[body.role as Role], body.role + '@demo.ma-shop.test', body.role).run();
        const token = crypto.randomUUID();
        await db.batch([db.prepare('DELETE FROM preview_sessions WHERE actor_id=?').bind(s.actor.id), db.prepare('INSERT INTO preview_sessions (token,actor_id,member_id,expires_at) VALUES (?,?,?,?)').bind(token, s.actor.id, member, Date.now() + 86400000)]);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('ma_preview',token,86400) });
    }
    if (area === 'profile') {
        const u = requireRole(s, allRoles);
        const columns = 'id,name,email,role,phone_e164,phone_verified,phone_verified_at,birthday,birthday_updated_at,created_at';
        if (req.method === 'GET')
            return json(await db.prepare(`SELECT ${columns} FROM members WHERE id=?`).bind(u.id).first());
        if (req.method !== 'PATCH')
            throw new ShopError('Thao tác không hỗ trợ.', 405);
        const current = await db.prepare('SELECT * FROM members WHERE id=?').bind(u.id).first<any>();
        if (!current)
            throw new ShopError('Không tìm thấy tài khoản.', 404);
        const sets: string[] = [], values: (string | number | null)[] = [];
        if (body.name !== undefined) {
            const name = textValue(body.name, 100);
            if (name.length < 2)
                throw new ShopError('Tên cần từ 2 đến 100 ký tự.');
            sets.push('name=?'); values.push(name);
        }
        if (body.phone !== undefined) {
            const phone = body.phone === '' || body.phone === null ? null : normalizePhone(body.phone);
            if (body.phone && !phone)
                throw new ShopError('Số điện thoại không hợp lệ.');
            // Đổi số điện thoại -> phải xác minh OTP lại.
            if (phone !== current.phone_e164)
                sets.push('phone_e164=?', 'phone_verified=0', 'phone_verified_at=NULL'), values.push(phone);
        }
        if (body.birthday !== undefined) {
            const birthday = body.birthday === '' || body.birthday === null ? null : body.birthday;
            if (birthday !== null) {
                if (!isYmd(birthday) || birthday > todayYmd() || birthday < '1900-01-01')
                    throw new ShopError('Ngày sinh không hợp lệ (YYYY-MM-DD).');
            }
            // Mỗi lần đổi ngày sinh đều đặt lại mốc birthday_updated_at (chống đổi ngày sinh sát ngày để nhận ưu đãi).
            if (birthday !== current.birthday)
                sets.push('birthday=?', 'birthday_updated_at=?'), values.push(birthday, birthday === null ? null : nowIso());
        }
        if (body.measurements !== undefined || body.body_profile !== undefined || body.save_measurements !== undefined) {
            const profileData = body.body_profile ?? body.measurements ?? {};
            const consent = body.save_measurements === true || body.consent === true || body.body_profile?.consent === true || body.measurements?.consent === true ? 1 : 0;
            if (body.delete_body_profile === true) {
                await db.prepare('DELETE FROM member_body_profiles WHERE member_id=?').bind(u.id).run();
            } else if (profileData && typeof profileData === 'object') {
                const rows = await db.prepare('SELECT * FROM member_body_profiles WHERE member_id=?').bind(u.id).first<any>();
                const payload = {
                    height_cm: profileData.height_cm ?? rows?.height_cm ?? null,
                    weight_kg: profileData.weight_kg ?? rows?.weight_kg ?? null,
                    fit_pref: ['ôm', 'vừa', 'rộng'].includes(String(profileData.fit_pref || profileData.fit || rows?.fit_pref || 'vừa')) ? String(profileData.fit_pref || profileData.fit || rows?.fit_pref || 'vừa') : 'vừa',
                    chest_cm: profileData.chest_cm ?? rows?.chest_cm ?? null,
                    waist_cm: profileData.waist_cm ?? rows?.waist_cm ?? null,
                    hip_cm: profileData.hip_cm ?? rows?.hip_cm ?? null,
                    shoulder_cm: profileData.shoulder_cm ?? rows?.shoulder_cm ?? null,
                    notes: typeof profileData.notes === 'string' ? profileData.notes.slice(0, 1000) : rows?.notes || '',
                    consent,
                };
                if (rows) {
                    await db.prepare('UPDATE member_body_profiles SET height_cm=?,weight_kg=?,fit_pref=?,chest_cm=?,waist_cm=?,hip_cm=?,shoulder_cm=?,notes=?,consent=?,updated_at=? WHERE member_id=?').bind(payload.height_cm, payload.weight_kg, payload.fit_pref, payload.chest_cm, payload.waist_cm, payload.hip_cm, payload.shoulder_cm, payload.notes, payload.consent, nowIso(), u.id).run();
                } else {
                    await db.prepare('INSERT INTO member_body_profiles (id,member_id,height_cm,weight_kg,fit_pref,chest_cm,waist_cm,hip_cm,shoulder_cm,notes,consent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), u.id, payload.height_cm, payload.weight_kg, payload.fit_pref, payload.chest_cm, payload.waist_cm, payload.hip_cm, payload.shoulder_cm, payload.notes, payload.consent, nowIso(), nowIso()).run();
                }
            }
        }
        if (sets.length)
            await db.prepare(`UPDATE members SET ${sets.join(',')} WHERE id=?`).bind(...values, u.id).run();
        grantWelcome(db, u.id);
        const profile = await db.prepare(`SELECT ${columns} FROM members WHERE id=?`).bind(u.id).first();
        const measurements = await db.prepare('SELECT * FROM member_body_profiles WHERE member_id=?').bind(u.id).first();
        return json({ ...profile, body_profile: measurements || null });
    }
    if (area === 'members') {
        requireRole(s, ['admin']);
        if (req.method === 'GET') {
            const m = await db.prepare(`
                SELECT m.*, COALESCE(c.password_plain,'') AS password
                FROM members m
                LEFT JOIN credentials c ON c.member_id = m.id
                ORDER BY m.demo ASC, CASE m.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END, m.name
            `).all();
            const invites = await db.prepare('SELECT * FROM invitations').all();
            return json({ members: m.results, invitations: invites.results });
        }
        if (!['POST','PATCH','DELETE'].includes(req.method)) throw new ShopError('Thao tác không hỗ trợ.',405);
        if (id) {
            const target = await db.prepare('SELECT * FROM members WHERE id=?').bind(id).first<Member>();
            if (!target)
                throw new ShopError('Không tìm thấy tài khoản.', 404);
            if (target.role === 'admin')
                throw new ShopError(req.method === 'DELETE' ? 'Không thể xóa tài khoản chủ shop.' : 'Không thể thay đổi quyền hoặc khóa chủ shop.');
            if (target.demo)
                throw new ShopError('Tài khoản mẫu giữ quyền cố định. Hãy dùng email để thêm thành viên thật.');
            if (req.method === 'DELETE') {
                await db.batch([
                    db.prepare('DELETE FROM auth_sessions WHERE member_id=?').bind(id),
                    db.prepare('DELETE FROM credentials WHERE member_id=?').bind(id),
                    db.prepare('DELETE FROM preview_sessions WHERE member_id=? OR actor_id=?').bind(id, id),
                    db.prepare('DELETE FROM cart WHERE owner_id=?').bind(id),
                    db.prepare('DELETE FROM favorites WHERE owner_id=?').bind(id),
                    db.prepare('DELETE FROM invitations WHERE email=?').bind(target.email),
                    db.prepare('DELETE FROM members WHERE id=? AND role!=?').bind(id, 'admin'),
                ]);
                return json({ ok: true });
            }
            if (req.method !== 'PATCH') throw new ShopError('Thao tác không hỗ trợ.',405);
            if (!['manager', 'staff', 'customer'].includes(body.role))
                throw new ShopError('Vai trò không hợp lệ.');
            const statements = [
                db.prepare('UPDATE members SET role=?,active=? WHERE id=?').bind(body.role, body.active === 0 ? 0 : 1, id),
                db.prepare('INSERT INTO invitations (email,name,role,active) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active').bind(target.email, target.name, body.role, body.active === 0 ? 0 : 1),
            ];
            if (body.password !== undefined && body.password !== null && body.password !== '') {
                const password = validatePassword(body.password);
                const passwordHash = await hashPassword(password);
                statements.push(db.prepare('UPDATE credentials SET password_hash=?, password_plain=? WHERE member_id=?').bind(passwordHash, password, id));
                statements.push(db.prepare('DELETE FROM auth_sessions WHERE member_id=?').bind(id));
            }
            await db.batch(statements);
            return json({ ok: true });
        }
        if (req.method !== 'POST') throw new ShopError('Thao tác không hỗ trợ.',405);
        const name = textValue(body.name, 100);
        const email = textValue(body.email, 200).toLowerCase();
        if (name.length < 2)
            throw new ShopError('Tên cần từ 2 đến 100 ký tự.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['manager', 'staff'].includes(body.role))
            throw new ShopError('Email hoặc vai trò không hợp lệ. Chỉ tạo tài khoản quản lý hoặc nhân viên.');
        const owner = await db.prepare("SELECT m.email FROM shop s JOIN members m ON s.owner_id=m.id WHERE s.id='main'").first<{
            email: string;
        }>();
        if (email === owner?.email)
            throw new ShopError('Không thể tạo trùng email chủ shop.');
        const existing = db.prepare('SELECT id,role FROM members WHERE email=? AND demo=0').bind(email).first<{ id: string; role: string }>();
        if (existing)
            throw new ShopError('Email này đã có tài khoản.', 409);
        const password = validatePassword(body.password);
        const memberId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);
        await db.batch([
            db.prepare("INSERT INTO members (id,name,email,role,active,demo,created_at) VALUES (?,?,?,?,1,0,?)").bind(memberId, name, email, body.role, nowIso()),
            db.prepare('INSERT INTO credentials (member_id,password_hash,password_plain) VALUES (?,?,?)').bind(memberId, passwordHash, password),
            db.prepare('INSERT INTO invitations (email,name,role,active) VALUES (?,?,?,1) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=1').bind(email, name, body.role),
        ]);
        return json({ ok: true, id: memberId }, 201);
    }
    return undefined;
}
