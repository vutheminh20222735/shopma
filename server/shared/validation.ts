import { ShopError } from '@server/shared/errors';
export const textValue = (v: unknown, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export const integerValue = (v: unknown, min: number, max: number) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max)
    throw new ShopError('Giá trị không hợp lệ.'); return n; };
