import { createHmac, timingSafeEqual } from 'node:crypto';
import { ShopError } from '@server/shared/errors';

export const signPayload = (secret: string, raw: string) => createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
/** Kiểm tra chữ ký HMAC-SHA256 (hex, có thể kèm tiền tố "sha256="). So sánh thời gian hằng định. */
export function verifySignature(secret: string, raw: string, header: string | null): boolean {
    if (!secret || !header) return false;
    const provided = header.trim().replace(/^sha256=/i, '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(provided)) return false;
    return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(signPayload(secret, raw), 'hex'));
}
export function requireSignedWebhook(req: Request, raw: string | undefined, secret: string) {
    if (!secret) throw new ShopError('Webhook chưa được cấu hình.', 503);
    const signature = req.headers.get('x-signature') || req.headers.get('x-webhook-signature');
    if (!verifySignature(secret, raw ?? '', signature)) throw new ShopError('Chữ ký webhook không hợp lệ.', 401);
}
