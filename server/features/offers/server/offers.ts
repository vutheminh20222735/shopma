import { randomInt } from 'node:crypto';
import type { ShopDatabase } from '@database/index';
import { ShopError } from '@server/shared/errors';
import { config } from '@server/shared/config';
import { inTransaction, newId } from '@server/shared/transaction';
import { addDays, addDaysIso, anniversaryDateForYear, daysBetween, endOfDayIso, nowIso, parseTime, startOfDayIso, toYmd, todayYmd, yearsSinceAccount } from '@server/shared/time';

export type OfferKind = 'welcome' | 'birthday' | 'anniversary';
export type OfferConfig = { id: string; kind: OfferKind; milestone: number; percent: number; max_discount: number; minimum: number; valid_days: number; active: number; updated_at: string };
type MemberLike = { id: string; created_at?: string; phone_e164?: string | null; phone_verified?: number; birthday?: string | null; birthday_updated_at?: string | null; role?: string };

/** Chuẩn hóa số điện thoại Việt Nam về dạng +84xxxxxxxxx. Trả null nếu không hợp lệ. */
export function normalizePhone(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!/^\+?[\d\s().-]{8,20}$/.test(text)) return null;
    const digits = text.replace(/\D/g, '');
    let rest = '';
    if (text.startsWith('+')) rest = digits.startsWith('84') ? digits.slice(2) : '';
    else if (digits.startsWith('84') && digits.length === 11) rest = digits.slice(2);
    else if (digits.startsWith('0')) rest = digits.slice(1);
    return /^[35789]\d{8}$/.test(rest) ? '+84' + rest : null;
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const generateCode = (prefix: string) => prefix + Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const prefixes: Record<OfferKind, string> = { welcome: 'WEL', birthday: 'BDAY', anniversary: 'ANV' };
export const getOfferConfig = (db: ShopDatabase, kind: OfferKind, milestone = 0) => db.prepare('SELECT * FROM offer_configs WHERE kind=? AND milestone=?').bind(kind, milestone).first<OfferConfig>();

function insertOffer(db: ShopDatabase, member: string, cfg: OfferConfig, extra: { startsAt: string; expiresAt: string; milestone?: number; yearKey?: number; phoneKey?: string }) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            db.prepare('INSERT INTO member_offers (id,member_id,kind,code,percent,max_discount,minimum,starts_at,expires_at,used_at,reserved_order_id,milestone,year_key,phone_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,NULL,\'\',?,?,?,?)')
                .bind(newId(), member, cfg.kind, generateCode(prefixes[cfg.kind]), cfg.percent, cfg.max_discount, cfg.minimum, extra.startsAt, extra.expiresAt, extra.milestone ?? 0, extra.yearKey ?? 0, extra.phoneKey ?? '', nowIso()).run();
            return true;
        } catch (error) {
            if (/idx_member_offers_code|member_offers\.code/.test(String((error as Error).message))) continue; // trùng mã ngẫu nhiên -> thử lại
            throw error;
        }
    }
    return false;
}

/** Chào mừng: 1 lần/số điện thoại (benefit_claims welcome:<phone>) và 1 lần/tài khoản; hạn = ngày tạo TK + valid_days. */
export function grantWelcome(db: ShopDatabase, memberId: string, now = new Date()): { granted: boolean; reason?: string } {
    const member = db.prepare('SELECT * FROM members WHERE id=?').bind(memberId).first<MemberLike>();
    if (!member?.phone_e164) return { granted: false, reason: 'no_phone' };
    const cfg = getOfferConfig(db, 'welcome');
    if (!cfg?.active || !member.created_at) return { granted: false, reason: 'disabled' };
    const startsAt = new Date(parseTime(member.created_at)).toISOString();
    const expiresAt = addDaysIso(startsAt, cfg.valid_days);
    if (parseTime(expiresAt) <= now.getTime()) return { granted: false, reason: 'expired' };
    try {
        return inTransaction(db, () => {
            if (db.prepare("SELECT id FROM member_offers WHERE member_id=? AND kind='welcome'").bind(memberId).first()) return { granted: false, reason: 'already' };
            const claim = db.prepare('INSERT OR IGNORE INTO benefit_claims (id,claim_key,kind,member_id,phone_key,year_key,created_at) VALUES (?,?,?,?,?,0,?)').bind(newId(), 'welcome:' + member.phone_e164, 'welcome', memberId, member.phone_e164!, nowIso()).run();
            if (!claim.meta.changes) return { granted: false, reason: 'phone_used' };
            return { granted: insertOffer(db, memberId, cfg, { startsAt, expiresAt, phoneKey: member.phone_e164! }) };
        });
    } catch (error) { console.error('grantWelcome failed', error); return { granted: false, reason: 'error' }; }
}

export type BirthdayStatus = { eligible: boolean; reasons: string[]; in_welcome_window: boolean; birthday_date: string | null; window_end: string | null; claimed: boolean };
/** Điều kiện ưu đãi sinh nhật. Trả danh sách lý do (tiếng Việt) nếu chưa đủ điều kiện. */
export function birthdayStatus(db: ShopDatabase, member: MemberLike, now = new Date()): BirthdayStatus {
    const reasons: string[] = [];
    const today = todayYmd(now);
    const cfg = getOfferConfig(db, 'birthday');
    const created = toYmd(member.created_at ?? '');
    const status: BirthdayStatus = { eligible: false, reasons, in_welcome_window: false, birthday_date: null, window_end: null, claimed: false };
    if (!cfg?.active) reasons.push('Ưu đãi sinh nhật đang tạm tắt.');
    if (!created || daysBetween(created, today) < 30) reasons.push('Tài khoản cần được tạo ít nhất 30 ngày.');
    if (!member.birthday) { reasons.push('Bạn chưa cập nhật ngày sinh.'); return status; }
    const validDays = cfg?.valid_days || 7;
    const year = Number(today.slice(0, 4));
    // Sinh nhật đang trong thời hạn nhận mã (có thể vắt sang năm trước) hoặc sinh nhật sắp tới.
    const candidates = [year - 1, year, year + 1].map(y => anniversaryDateForYear(member.birthday!, y));
    const bday = candidates.find(candidate => candidate <= today && today <= addDays(candidate, validDays - 1)) || candidates.find(candidate => candidate > today)!;
    status.birthday_date = bday;
    status.window_end = addDays(bday, validDays - 1);
    if (!(bday <= today && today <= status.window_end)) reasons.push('Chưa đến thời gian nhận ưu đãi sinh nhật.');
    const updated = toYmd(member.birthday_updated_at ?? '');
    if (!updated || updated > addDays(bday, -30)) reasons.push('Ngày sinh cần được cập nhật trước sinh nhật ít nhất 30 ngày.');
    if (!member.phone_e164) reasons.push('Bạn cần thêm số điện thoại.');
    else if (!member.phone_verified && config.otpMode !== 'test') reasons.push('Bạn cần xác minh số điện thoại bằng mã OTP.');
    const order = db.prepare("SELECT id FROM orders WHERE customer_id=? AND status='delivered' AND payment_status='paid' AND refund_status!='refunded' LIMIT 1").bind(member.id).first();
    if (!order) reasons.push('Bạn cần có ít nhất một đơn đã giao và đã thanh toán (chưa hoàn tiền).');
    const welcome = getOfferConfig(db, 'welcome');
    if (created && welcome && bday >= created && bday < addDays(created, welcome.valid_days)) status.in_welcome_window = true;
    if (member.phone_e164) status.claimed = !!db.prepare('SELECT id FROM benefit_claims WHERE claim_key=?').bind(`birthday:${member.phone_e164}:${bday.slice(0, 4)}`).first();
    status.eligible = reasons.length === 0 && !status.in_welcome_window && !status.claimed;
    return status;
}

/** Cấp mã sinh nhật nếu đủ điều kiện: 1 lần/số điện thoại/năm. Nếu sinh nhật nằm trong thời hạn mã chào mừng thì chỉ hiện mã chào mừng. */
export function grantBirthday(db: ShopDatabase, memberId: string, now = new Date()): { granted: boolean; status?: BirthdayStatus } {
    const member = db.prepare('SELECT * FROM members WHERE id=?').bind(memberId).first<MemberLike>();
    if (!member) return { granted: false };
    const status = birthdayStatus(db, member, now);
    if (!status.eligible) return { granted: false, status };
    const cfg = getOfferConfig(db, 'birthday')!;
    const year = Number(status.birthday_date!.slice(0, 4));
    try {
        const granted = inTransaction(db, () => {
            const claim = db.prepare('INSERT OR IGNORE INTO benefit_claims (id,claim_key,kind,member_id,phone_key,year_key,created_at) VALUES (?,?,?,?,?,?,?)').bind(newId(), `birthday:${member.phone_e164}:${year}`, 'birthday', memberId, member.phone_e164!, year, nowIso()).run();
            if (!claim.meta.changes) return false;
            return insertOffer(db, memberId, cfg, { startsAt: startOfDayIso(status.birthday_date!), expiresAt: endOfDayIso(status.window_end!), yearKey: year, phoneKey: member.phone_e164! });
        });
        return { granted, status };
    } catch (error) { console.error('grantBirthday failed', error); return { granted: false, status }; }
}

/** Kỷ niệm: mốc = số năm tròn (1,2,3,4...), cấu hình lấy theo min(năm,3). Duy nhất theo (thành viên, mốc). */
export function grantAnniversary(db: ShopDatabase, member: MemberLike, now = new Date()): boolean {
    const today = todayYmd(now);
    const years = yearsSinceAccount(member.created_at, today);
    if (years < 1) return false;
    const cfg = getOfferConfig(db, 'anniversary', Math.min(years, 3));
    if (!cfg?.active) return false;
    const date = anniversaryDateForYear(toYmd(member.created_at!), Number(today.slice(0, 4)));
    const expiresAt = startOfDayIso(addDays(date, cfg.valid_days));
    if (parseTime(expiresAt) <= now.getTime()) return false;
    const existing = db.prepare("SELECT id FROM member_offers WHERE member_id=? AND kind='anniversary' AND milestone=?").bind(member.id, years).first();
    if (existing) return false;
    try { return insertOffer(db, member.id, cfg, { startsAt: startOfDayIso(date), expiresAt, milestone: years }); }
    catch (error) { if (/UNIQUE/i.test(String((error as Error).message))) return false; throw error; }
}

export function syncMemberOffers(db: ShopDatabase, memberId: string, now = new Date()) {
    const member = db.prepare('SELECT * FROM members WHERE id=? AND active=1 AND demo=0').bind(memberId).first<MemberLike>();
    if (!member || member.role !== 'customer') return;
    grantWelcome(db, memberId, now);
    grantBirthday(db, memberId, now);
    grantAnniversary(db, member, now);
}

export const offerStatus = (offer: any, now = Date.now()) => offer.used_at ? 'used' : parseTime(offer.expires_at) <= now ? 'expired' : parseTime(offer.starts_at) > now ? 'upcoming' : 'active';
export const offerDiscount = (offer: { percent: number; max_discount: number }, subtotal: number) => Math.min(Math.round(subtotal * offer.percent / 100), offer.max_discount);
export const offerRow = (o: any, now = Date.now()) => ({ id: o.id, kind: o.kind, code: o.code, percent: o.percent, max_discount: o.max_discount, minimum: o.minimum, starts_at: o.starts_at, expires_at: o.expires_at, used_at: o.used_at, milestone: o.milestone, status: offerStatus(o, now) });

/**
 * Tìm mã ưu đãi thành viên theo mã. Trả null nếu mã không thuộc bảng member_offers (để rơi về bảng coupons).
 * Ném ShopError nếu mã thuộc người khác / đã dùng / hết hạn / chưa đủ giá trị đơn tối thiểu.
 */
export function findUsableOffer(db: ShopDatabase, memberId: string, code: string, subtotal: number, now = Date.now()) {
    const offer = db.prepare('SELECT * FROM member_offers WHERE code=?').bind(code).first<any>();
    if (!offer) return null;
    if (offer.member_id !== memberId) throw new ShopError('Mã ưu đãi không áp dụng cho tài khoản này.');
    const status = offerStatus(offer, now);
    if (status === 'used') throw new ShopError('Mã ưu đãi đã được sử dụng.');
    if (status === 'expired') throw new ShopError('Mã ưu đãi đã hết hạn.');
    if (status === 'upcoming') throw new ShopError('Mã ưu đãi chưa đến thời gian sử dụng.');
    if (subtotal < offer.minimum) throw new ShopError('Đơn hàng cần tối thiểu ' + new Intl.NumberFormat('vi-VN').format(offer.minimum) + 'đ để dùng mã này.');
    return { ...offer, discount: offerDiscount(offer, subtotal) };
}

/** Đặt chỗ (đánh dấu đã dùng) mã ưu đãi cho đơn — gọi trong transaction. Trả false nếu đã bị dùng/hết hạn (race). */
export function reserveOffer(db: ShopDatabase, offerId: string, orderId: string, memberId: string, now = nowIso()): boolean {
    return db.prepare("UPDATE member_offers SET used_at=?,reserved_order_id=? WHERE id=? AND member_id=? AND used_at IS NULL AND expires_at>? AND starts_at<=?").bind(now, orderId, offerId, memberId, now, now).run().meta.changes === 1;
}
