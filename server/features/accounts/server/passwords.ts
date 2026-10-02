import { randomBytes, scrypt as deriveKey, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ShopError } from '@server/shared/errors';
const scrypt = promisify(deriveKey);
export function validatePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
        throw new ShopError('Mật khẩu cần từ 10 đến 128 ký tự.');
    }
    return value;
}
export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const key = await scrypt(password, salt, 64) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored?: string) {
    const [algorithm, salt, hash] = (stored || 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128)).split(':');
    if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
    const key = await scrypt(password, salt, 64) as Buffer;
    return timingSafeEqual(key, Buffer.from(hash, 'hex')) && Boolean(stored);
}
