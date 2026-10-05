import type { ShopDatabase } from '@database/index';

let depth = 0;
/**
 * Chạy `fn` (đồng bộ) trong BEGIN IMMEDIATE ... COMMIT. Ném lỗi -> ROLLBACK.
 * Gọi lồng nhau thì dùng chung transaction ngoài cùng. Không gọi db.batch bên trong.
 */
export function inTransaction<T>(db: ShopDatabase, fn: () => T): T {
    if (depth > 0) return fn();
    db.raw.exec('BEGIN IMMEDIATE');
    depth++;
    try {
        const result = fn();
        db.raw.exec('COMMIT');
        return result;
    } catch (error) {
        try { db.raw.exec('ROLLBACK'); } catch { /* đã rollback */ }
        throw error;
    } finally { depth--; }
}
export const newId = () => crypto.randomUUID();
