import { ShopError } from '@server/shared/errors';
import { textValue, integerValue } from '@server/shared/validation';
import { productRow } from '@server/features/products/server/serialization';
import { requireRole, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
export async function productsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s, body } = ctx;
    if (area === 'products') {
        if (req.method === 'GET') {
            const manage = url.searchParams.get('manage') === '1';
            if (manage)
                requireRole(s, teamRoles);
            if (id) {
                const row = await db.prepare('SELECT * FROM products WHERE id=?' + (!manage ? ' AND active=1' : '')).bind(id).first();
                if (!row)
                    throw new ShopError('Không tìm thấy sản phẩm.', 404);
                const variants = await db.prepare('SELECT * FROM variants WHERE product_id=?').bind(id).all();
                return json({ ...productRow(row), variants: variants.results });
            }
            const rows = await db.prepare('SELECT * FROM products' + (!manage ? ' WHERE active=1' : '') + ' ORDER BY is_new DESC,rowid ASC').all();
            return json(rows.results.map(productRow));
        }
        requireRole(s, managementRoles);
        if (req.method === 'DELETE') {
            await db.prepare('UPDATE products SET active=0 WHERE id=?').bind(id).run();
            return json({ ok: true });
        }
        if (!['POST', 'PATCH'].includes(req.method))
            throw new ShopError('Thao tác không hỗ trợ.', 405);
        const name = textValue(body.name, 120);
        const category = textValue(body.category, 40);
        const gender = textValue(body.gender, 20);
        const price = integerValue(body.price, 1000, 100000000);
        const original = integerValue(body.original_price || 0, 0, 100000000);
        const sizes = Array.isArray(body.sizes) ? body.sizes.map((v: unknown) => textValue(v, 20)).filter(Boolean) : [];
        const colors = Array.isArray(body.colors) ? body.colors.map((v: unknown) => textValue(v, 30)).filter(Boolean) : [];
        const image = textValue(body.image, 500);
        if (!name || !category || !['Nam', 'Nữ', 'Unisex'].includes(gender) || !sizes.length || !colors.length || sizes.length > 8 || colors.length > 8)
            throw new ShopError('Điền tên, danh mục, giới tính, size và màu sản phẩm.');
        if (!image.startsWith('/images/') && !/^https:\/\//.test(image))
            throw new ShopError('Ảnh sản phẩm cần là đường dẫn hợp lệ.');
        if (original && original < price)
            throw new ShopError('Giá gốc cần lớn hơn hoặc bằng giá bán.');
        const productId = id || crypto.randomUUID();
        const statements = [];
        if (id) {
            const current = await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first<any>();
            if (!current)
                throw new ShopError('Không tìm thấy sản phẩm.', 404);
            const oldSizes = JSON.parse(current.sizes), oldColors = JSON.parse(current.colors);
            if (oldSizes.some((v: string) => !sizes.includes(v)) || oldColors.some((v: string) => !colors.includes(v)))
                throw new ShopError('Giữ các size và màu hiện có để bảo toàn đơn hàng. Bạn có thể thêm biến thể hoặc ẩn sản phẩm.');
        }
        statements.push(db.prepare('INSERT INTO products (id,name,category,gender,price,original_price,image,description,material,colors,sizes,is_new,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,gender=excluded.gender,price=excluded.price,original_price=excluded.original_price,image=excluded.image,description=excluded.description,material=excluded.material,colors=excluded.colors,sizes=excluded.sizes,is_new=excluded.is_new,active=excluded.active').bind(productId, name, category, gender, price, original, image, textValue(body.description, 2000), textValue(body.material, 150), JSON.stringify([...new Set(colors)]), JSON.stringify([...new Set(sizes)]), body.is_new ? 1 : 0, body.active === 0 ? 0 : 1));
        for (const size of sizes)
            for (const color of colors)
                statements.push(db.prepare('INSERT OR IGNORE INTO variants (id,product_id,size,color,stock) VALUES (?,?,?,?,?)').bind(productId + '-' + size + '-' + color, productId, size, color, id ? 0 : integerValue(body.stock ?? 10, 0, 100000)));
        await db.batch(statements);
        return json({ id: productId });
    }
    return undefined;
}
