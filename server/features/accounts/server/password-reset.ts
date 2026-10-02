import { randomBytes, randomInt } from 'node:crypto';
import { config } from '@server/shared/config';
import { database } from '@server/shared/database';
import { ShopError } from '@server/shared/errors';
import { hashToken } from './session';
import { hashPassword, validatePassword } from './passwords';
import { mailConfigured, sendMail } from './mail';

const RESET_TTL_MS = () => config.passwordResetMinutes * 60_000;

export async function requestPasswordReset(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ShopError('Email không hợp lệ.');
    }
    const db = database();
    db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<=? OR used_at IS NOT NULL').bind(Date.now()).run();
    const member = db.prepare('SELECT id,name,email FROM members WHERE email=? AND demo=0 AND active=1').bind(email).first<{
        id: string;
        name: string;
        email: string;
    }>();
    // Không tiết lộ email có tồn tại; không trả link/mã về trình duyệt.
    const generic = {
        ok: true,
        message: 'Nếu email đã đăng ký, chúng tôi đã gửi mã và liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (và mục spam). Liên kết/mã có hiệu lực 15 phút.',
    };
    if (!member) return generic;

    const token = randomBytes(32).toString('hex');
    const code = String(randomInt(100000, 1000000));
    const expiresAt = Date.now() + RESET_TTL_MS();
    db.batch([
        db.prepare('DELETE FROM password_reset_tokens WHERE member_id=?').bind(member.id),
        db.prepare('INSERT INTO password_reset_tokens (token_hash,member_id,expires_at,used_at,code_hash) VALUES (?,?,?,NULL,?)')
            .bind(hashToken(token), member.id, expiresAt, hashToken(code)),
    ]);
    const resetUrl = `${config.appOrigin}/dat-lai-mat-khau?token=${token}`;
    const text = [
        `Xin chào ${member.name},`,
        '',
        'Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu M&A Shop.',
        '',
        `Mã xác nhận (6 số): ${code}`,
        `Hoặc mở liên kết (hiệu lực ${config.passwordResetMinutes} phút):`,
        resetUrl,
        '',
        'Không chia sẻ mã/link cho người khác. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.',
        '',
        'M&A Shop',
    ].join('\n');
    await sendMail({
        to: member.email,
        subject: 'Mã đặt lại mật khẩu M&A Shop',
        text,
        html: `<p>Xin chào <strong>${member.name}</strong>,</p>
<p>Bạn vừa yêu cầu đặt lại mật khẩu M&A Shop.</p>
<p style="font-size:24px;letter-spacing:4px;font-weight:700">Mã xác nhận: ${code}</p>
<p>Hoặc <a href="${resetUrl}">nhấn vào đây để đặt mật khẩu mới</a>.</p>
<p>Mã và liên kết có hiệu lực ${config.passwordResetMinutes} phút. Không chia sẻ cho người khác.</p>
<p>Nếu không phải bạn, hãy bỏ qua email này.</p>`,
    });

    // Chỉ ghi console / trả debug khi chạy test tự động — không hiện trên web để tránh rò rỉ.
    if (!mailConfigured()) {
        console.log(`[password-reset] SMTP chưa cấu hình. Email giả lập tới ${member.email}`);
        console.log(`[password-reset] mã=${code}`);
        console.log(`[password-reset] link=${resetUrl}`);
    }
    if (process.env.NODE_ENV === 'test') {
        return { ...generic, debugResetUrl: resetUrl, debugResetCode: code };
    }
    return generic;
}

type ResetInput = {
    token?: string;
    email?: string;
    code?: string;
    password: unknown;
};

export async function resetPasswordWithToken(input: ResetInput | string, passwordRaw?: unknown) {
    // Hỗ trợ cả chữ ký cũ (token, password) và object mới.
    const body: ResetInput = typeof input === 'string'
        ? { token: input, password: passwordRaw }
        : input;
    const password = validatePassword(body.password);
    const db = database();
    let row: { token_hash: string; member_id: string; expires_at: number; used_at: number | null } | null = null;

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (token) {
        if (!/^[a-f0-9]{64}$/.test(token)) throw new ShopError('Liên kết hoặc mã đặt lại không hợp lệ hoặc đã hết hạn.');
        row = db.prepare(`
            SELECT t.token_hash, t.member_id, t.expires_at, t.used_at
            FROM password_reset_tokens t
            JOIN members m ON m.id = t.member_id
            WHERE t.token_hash=? AND m.active=1 AND m.demo=0
        `).bind(hashToken(token)).first();
    } else {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
            throw new ShopError('Email hoặc mã xác nhận không hợp lệ.');
        }
        row = db.prepare(`
            SELECT t.token_hash, t.member_id, t.expires_at, t.used_at
            FROM password_reset_tokens t
            JOIN members m ON m.id = t.member_id
            WHERE m.email=? AND t.code_hash=? AND m.active=1 AND m.demo=0
            ORDER BY t.expires_at DESC
        `).bind(email, hashToken(code)).first();
    }

    if (!row || row.used_at || row.expires_at <= Date.now()) {
        throw new ShopError('Liên kết hoặc mã đặt lại không hợp lệ hoặc đã hết hạn.');
    }
    const passwordHash = await hashPassword(password);
    db.batch([
        db.prepare('UPDATE credentials SET password_hash=?, password_plain=? WHERE member_id=?').bind(passwordHash, password, row.member_id),
        db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE token_hash=?').bind(Date.now(), row.token_hash),
        db.prepare('DELETE FROM password_reset_tokens WHERE member_id=? AND token_hash!=?').bind(row.member_id, row.token_hash),
        db.prepare('DELETE FROM auth_sessions WHERE member_id=?').bind(row.member_id),
        db.prepare('DELETE FROM preview_sessions WHERE actor_id=? OR member_id=?').bind(row.member_id, row.member_id),
    ]);
    return { ok: true, message: 'Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.' };
}
