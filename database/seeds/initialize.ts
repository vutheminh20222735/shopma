import { seedProducts } from '@database/seeds/catalog';
import { database } from '@server/shared/database';
import type { PreparedQuery } from '@database/index';
let seedTask: Promise<void> | null = null;
export async function ensureCatalog() {
    if (!seedTask)
        seedTask = (async () => {
            const db = database();
            const count = await db.prepare('SELECT COUNT(*) AS n FROM products').first<{
                n: number;
            }>();
            if (count?.n)
                return;
            const statements: PreparedQuery[] = [];
            for (const p of seedProducts) {
                statements.push(db.prepare('INSERT OR IGNORE INTO products (id,name,category,gender,price,original_price,image,description,material,colors,sizes,is_new,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(p.id, p.name, p.category, p.gender, p.price, p.original_price, p.image, p.description, p.material, JSON.stringify(p.colors), JSON.stringify(p.sizes), p.is_new, 1));
                for (const size of p.sizes)
                    for (const color of p.colors)
                        statements.push(db.prepare('INSERT OR IGNORE INTO variants (id,product_id,size,color,stock) VALUES (?,?,?,?,?)').bind(p.id + '-' + size + '-' + color, p.id, size, color, 10));
            }
            statements.push(db.prepare('INSERT OR IGNORE INTO coupons (code,percent,minimum,active) VALUES (?,?,?,?)').bind('MA10', 10, 300000, 1));
            await db.batch(statements);
        })().catch(e => { seedTask = null; throw e; });
    await seedTask;
}
