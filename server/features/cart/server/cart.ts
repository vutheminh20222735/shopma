import { database } from '@server/shared/database';
import { productRow } from '@server/features/products/server/serialization';
export async function getCart(owner: string) { const db = database(); const rows = await db.prepare('SELECT c.id,c.quantity,v.id AS variant_id,v.product_id,v.size,v.color,v.stock FROM cart c JOIN variants v ON v.id=c.variant_id WHERE c.owner_id=?').bind(owner).all<any>(); const items = []; for (const row of rows.results) {
    const p = await db.prepare('SELECT * FROM products WHERE id=?').bind(row.product_id).first();
    if (p)
        items.push({ ...row, product: productRow(p) });
} return items; }
