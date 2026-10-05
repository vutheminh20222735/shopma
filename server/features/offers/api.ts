import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { ShopError } from '@server/shared/errors';
import { config } from '@server/shared/config';
import { textValue, integerValue } from '@server/shared/validation';
import { requireRole, allRoles, managementRoles } from '@server/features/accounts/server/session';
import { birthdayStatus, findUsableOffer, getOfferConfig, grantWelcome, normalizePhone, offerRow, syncMemberOffers, type OfferKind } from '@server/features/offers/server/offers';
import { inTransaction, newId } from '@server/shared/transaction';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';

const KINDS: OfferKind[] = ['welcome', 'birthday', 'anniversary'];
function parseConfigBody(body: Record<string, any>, current?: any) {
    const pick = (key: string, min: number, max: number) => body[key] === undefined && current ? current[key] : integerValue(body[key], min, max);
    return { percent: pick('percent', 1, 50), max_discount: pick('max_discount', 0, 10000000), minimum: pick('minimum', 0, 100000000), valid_days: pick('valid_days', 1, 365), active: body.active === undefined && current ? current.active : (body.active === 0 || body.active === false ? 0 : 1) };
}

export async function offersApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, area, id, db, s, body } = ctx;

    // Mã ưu đãi của tôi (tự cấp mã chào mừng/sinh nhật/kỷ niệm nếu đủ điều kiện).
    if (area === 'my-offers') {
        const u = requireRole(s, allRoles);
        if (req.method !== 'GET') throw new ShopError('Thao tác không hỗ trợ.', 405);
        syncMemberOffers(db, u.id);
        const member = db.prepare('SELECT * FROM members WHERE id=?').bind(u.id).first<any>();
        const now = Date.now();
        const rows = db.prepare('SELECT * FROM member_offers WHERE member_id=? ORDER BY created_at DESC').bind(u.id).all<any>().results;
        const birthday = birthdayStatus(db, member);
        // Sinh nhật trùng thời hạn mã chào mừng: chỉ hiển thị mã chào mừng.
        const visible = rows.filter(o => !(o.kind === 'birthday' && birthday.in_welcome_window));
        return json({ offers: visible.map(o => offerRow(o, now)), birthday: { eligible: birthday.eligible, reasons: birthday.in_welcome_window ? [] : birthday.reasons, in_welcome_window: birthday.in_welcome_window, birthday_date: birthday.birthday_date, claimed: birthday.claimed }, phone: { e164: member.phone_e164, verified: !!member.phone_verified } });
    }

    if (area !== 'offers') return undefined;

    // Kiểm tra mã trước khi đặt hàng: mã thành viên hoặc coupon thường (không cộng dồn).
    if (id === 'apply') {
        const u = requireRole(s, allRoles);
        if (req.method !== 'POST') throw new ShopError('Thao tác không hỗ trợ.', 405);
        const code = textValue(body.code, 40).toUpperCase();
        const subtotal = integerValue(body.subtotal, 0, 1000000000);
        if (!code) throw new ShopError('Vui lòng nhập mã ưu đãi.');
        const offer = findUsableOffer(db, u.id, code, subtotal);
        if (offer) return json({ code, source: 'member_offer', kind: offer.kind, percent: offer.percent, max_discount: offer.max_discount, minimum: offer.minimum, discount: offer.discount, expires_at: offer.expires_at, stackable: false });
        const coupon = db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').bind(code).first<any>();
        if (!coupon || subtotal < coupon.minimum) throw new ShopError('Mã ưu đãi không áp dụng cho đơn này.');
        return json({ code, source: 'coupon', kind: 'coupon', percent: coupon.percent, minimum: coupon.minimum, discount: Math.round(subtotal * coupon.percent / 100), stackable: false });
    }

    // Quản trị cấu hình (xem: admin/manager; sửa: chỉ admin) + lịch sử thay đổi.
    requireRole(s, managementRoles);
    if (req.method === 'GET') {
        if (id === 'history') {
            const rows = db.prepare('SELECT h.*,m.name AS actor_name FROM offer_config_history h LEFT JOIN members m ON m.id=h.actor_id ORDER BY h.created_at DESC LIMIT 200').all<any>().results;
            return json(rows.map(r => ({ ...r, snapshot: JSON.parse(r.snapshot) })));
        }
        if (id === 'issued') {
            const rows = db.prepare('SELECT o.*,m.name AS member_name,m.email FROM member_offers o LEFT JOIN members m ON m.id=o.member_id ORDER BY o.created_at DESC LIMIT 200').all<any>().results;
            return json(rows.map(r => ({ ...offerRow(r), member_id: r.member_id, member_name: r.member_name, email: r.email })));
        }
        return json(db.prepare('SELECT * FROM offer_configs ORDER BY kind,milestone').all().results);
    }
    const admin = requireRole(s, ['admin']);
    const snapshot = (configId: string, action: string, before: unknown, after: unknown) =>
        db.prepare('INSERT INTO offer_config_history (id,config_id,actor_id,snapshot,created_at) VALUES (?,?,?,?,?)').bind(newId(), configId, admin.id, JSON.stringify({ action, before, after }), nowIso()).run();

    if (req.method === 'POST' && !id) {
        const kind = textValue(body.kind, 20) as OfferKind;
        if (!KINDS.includes(kind)) throw new ShopError('Loại ưu đãi không hợp lệ.');
        const milestone = kind === 'anniversary' ? integerValue(body.milestone, 1, 3) : 0;
        if (getOfferConfig(db, kind, milestone)) throw new ShopError('Cấu hình này đã tồn tại. Hãy chỉnh sửa thay vì tạo mới.', 409);
        const values = parseConfigBody(body);
        const configId = newId();
        inTransaction(db, () => {
            db.prepare('INSERT INTO offer_configs (id,kind,milestone,percent,max_discount,minimum,valid_days,active,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(configId, kind, milestone, values.percent, values.max_discount, values.minimum, values.valid_days, values.active, nowIso()).run();
            snapshot(configId, 'create', null, { kind, milestone, ...values });
        });
        return json({ id: configId }, 201);
    }
    if (!id) throw new ShopError('Thao tác không hỗ trợ.', 405);
    const current = db.prepare('SELECT * FROM offer_configs WHERE id=?').bind(id).first<any>();
    if (!current) throw new ShopError('Không tìm thấy cấu hình ưu đãi.', 404);
    if (req.method === 'PATCH') {
        const values = parseConfigBody(body, current);
        inTransaction(db, () => {
            db.prepare('UPDATE offer_configs SET percent=?,max_discount=?,minimum=?,valid_days=?,active=?,updated_at=? WHERE id=?').bind(values.percent, values.max_discount, values.minimum, values.valid_days, values.active, nowIso(), id).run();
            snapshot(id, 'update', current, { ...current, ...values });
        });
        return json({ ok: true });
    }
    if (req.method === 'DELETE') {
        // Xóa mềm: tắt cấu hình, giữ lịch sử và các mã đã cấp.
        inTransaction(db, () => {
            db.prepare('UPDATE offer_configs SET active=0,updated_at=? WHERE id=?').bind(nowIso(), id).run();
            snapshot(id, 'disable', current, { ...current, active: 0 });
        });
        return json({ ok: true });
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}

// ---------------- OTP xác minh số điện thoại ----------------
const OTP_TTL_MS = 5 * 60000, OTP_COOLDOWN_MS = 60000, OTP_MAX_PER_HOUR = 5, OTP_MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; expires: number }>();
const otpHash = (memberId: string, phone: string, code: string) => createHash('sha256').update(`${memberId}:${phone}:${code}`).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function otpApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, area, id, db, s, body } = ctx;
    if (area !== 'otp') return undefined;
    const u = requireRole(s, allRoles);
    if (req.method !== 'POST') throw new ShopError('Thao tác không hỗ trợ.', 405);
    const now = Date.now();

    if (id === 'send') {
        const phone = normalizePhone(body.phone);
        if (!phone) throw new ShopError('Số điện thoại không hợp lệ.');
        const taken = db.prepare('SELECT id FROM members WHERE phone_e164=? AND phone_verified=1 AND id!=?').bind(phone, u.id).first();
        if (taken) throw new ShopError('Số điện thoại này đã được xác minh bởi tài khoản khác.', 409);
        const last = db.prepare('SELECT created_at FROM otp_codes WHERE member_id=? ORDER BY created_at DESC LIMIT 1').bind(u.id).first<{ created_at: string }>();
        if (last && now - Date.parse(last.created_at) < OTP_COOLDOWN_MS) throw new ShopError('Vui lòng đợi 60 giây trước khi gửi lại mã.', 429);
        const hourAgo = new Date(now - 3600000).toISOString();
        const byMember = db.prepare('SELECT COUNT(*) AS n FROM otp_codes WHERE member_id=? AND created_at>?').bind(u.id, hourAgo).first<{ n: number }>()!.n;
        const byPhone = db.prepare('SELECT COUNT(*) AS n FROM otp_codes WHERE phone_e164=? AND created_at>?').bind(phone, hourAgo).first<{ n: number }>()!.n;
        if (byMember >= OTP_MAX_PER_HOUR || byPhone >= OTP_MAX_PER_HOUR) throw new ShopError('Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.', 429);
        const code = String(randomInt(100000, 1000000));
        inTransaction(db, () => {
            db.prepare('UPDATE otp_codes SET used_at=? WHERE member_id=? AND used_at IS NULL').bind(now, u.id).run();
            db.prepare('INSERT INTO otp_codes (id,member_id,phone_e164,code_hash,purpose,expires_at,used_at,created_at) VALUES (?,?,?,?,?,?,NULL,?)').bind(newId(), u.id, phone, otpHash(u.id, phone, code), 'phone_verify', now + OTP_TTL_MS, new Date(now).toISOString()).run();
        });
        // Nhà cung cấp SMS là stub: ngoài production chỉ in mã ra console server (giống email đặt lại mật khẩu).
        if (!config.production) console.log(`[OTP stub] ${phone}: ${code}`);
        else console.warn('[OTP] Chưa cấu hình nhà cung cấp SMS; mã không được gửi tới ' + phone.slice(0, 6) + '***');
        return json({ ok: true, expires_in: OTP_TTL_MS / 1000, mode: config.otpMode });
    }

    if (id === 'verify') {
        const code = textValue(body.code, 10);
        if (!/^\d{6}$/.test(code)) throw new ShopError('Mã xác minh gồm 6 chữ số.');
        for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
        const bucket = attempts.get(u.id) || { count: 0, expires: now + 15 * 60000 };
        if (bucket.count >= OTP_MAX_ATTEMPTS) {
            db.prepare('UPDATE otp_codes SET used_at=? WHERE member_id=? AND used_at IS NULL').bind(now, u.id).run();
            throw new ShopError('Bạn nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới sau ít phút.', 429);
        }
        const row = db.prepare('SELECT * FROM otp_codes WHERE member_id=? AND used_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(u.id, now).first<any>();
        // Mã cố định 000000 chỉ có hiệu lực khi OTP_MODE=test và không chạy production.
        const testBypass = config.otpMode === 'test' && !config.production && code === '000000';
        const phone = row?.phone_e164 || (testBypass ? normalizePhone(body.phone) : null);
        const ok = testBypass ? !!phone : !!row && sameHash(row.code_hash, otpHash(u.id, row.phone_e164, code));
        if (!ok || !phone) {
            bucket.count++; attempts.set(u.id, bucket);
            throw new ShopError('Mã xác minh không đúng hoặc đã hết hạn.', 400);
        }
        inTransaction(db, () => {
            if (db.prepare('SELECT id FROM members WHERE phone_e164=? AND phone_verified=1 AND id!=?').bind(phone, u.id).first()) throw new ShopError('Số điện thoại này đã được xác minh bởi tài khoản khác.', 409);
            if (row) db.prepare('UPDATE otp_codes SET used_at=? WHERE id=?').bind(now, row.id).run();
            db.prepare('UPDATE members SET phone_e164=?,phone_verified=1,phone_verified_at=? WHERE id=?').bind(phone, nowIso(), u.id).run();
        });
        attempts.delete(u.id);
        const welcome = grantWelcome(db, u.id);
        return json({ ok: true, phone_e164: phone, verified: true, welcome_granted: welcome.granted });
    }
    throw new ShopError('Không tìm thấy chức năng.', 404);
}
