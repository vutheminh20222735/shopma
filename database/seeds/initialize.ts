import { seedBanners, seedProducts } from '@database/seeds/catalog';
import { database } from '@server/shared/database';
import type { PreparedQuery } from '@database/index';
let seedTask: Promise<void> | null = null;
export async function ensureCatalog() {
    if (!seedTask)
        seedTask = (async () => {
            const db = database();
            const statements: PreparedQuery[] = [];
            for (const p of seedProducts) {
                statements.push(db.prepare('INSERT OR IGNORE INTO products (id,name,category,gender,price,original_price,image,description,material,colors,sizes,is_new,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(p.id, p.name, p.category, p.gender, p.price, p.original_price, p.image, p.description, p.material, JSON.stringify(p.colors), JSON.stringify(p.sizes), p.is_new, 1));
                for (const size of p.sizes)
                    for (const color of p.colors)
                        statements.push(db.prepare('INSERT OR IGNORE INTO variants (id,product_id,size,color,stock) VALUES (?,?,?,?,?)').bind(p.id + '-' + size + '-' + color, p.id, size, color, 10));
            }
            for (const banner of seedBanners) {
                const fields = ['id','title','subtitle','description','image','mobile_image','href','active','sort_order','button_label'];
                const values = [banner.id, banner.title, banner.subtitle, banner.description, banner.image, banner.mobile_image, banner.href, banner.active, banner.sort_order, banner.button_label || 'Khám phá'];
                statements.push(db.prepare(`INSERT OR IGNORE INTO site_banners (${fields.join(',')},created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(...values, new Date().toISOString()));
            }
            statements.push(db.prepare('INSERT OR IGNORE INTO coupons (code,percent,minimum,active) VALUES (?,?,?,?)').bind('MA10', 10, 300000, 1));
            if (statements.length) await db.batch(statements);
        })().catch(e => { seedTask = null; throw e; });
    await seedTask;
}
