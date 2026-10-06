import { ShopError } from '@server/shared/errors';
import { textValue, integerValue } from '@server/shared/validation';
import { productRow } from '@server/features/products/server/serialization';
import { canEditProducts } from '@server/features/products/uploads';
import { requireRole, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import { getSizeRecommendation } from '@server/features/products/size-recommendation';
import type { ShopRequestContext } from '@server/shared/context';
export async function productsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, action, db, s, body } = ctx;
    // Quyền sửa sản phẩm của nhân viên (chỉ admin/quản lý cấp).
    if (area === 'product-grants') {
        const u = requireRole(s, managementRoles);
        if (req.method === 'GET') {
            const rows = await db.prepare("SELECT m.id,m.name,m.email,COALESCE(g.can_edit,0) AS can_edit FROM members m LEFT JOIN product_edit_grants g ON g.member_id=m.id WHERE m.role='staff' AND m.demo=0 AND m.active=1 ORDER BY m.name").all();
            return json(rows.results);
        }
        if (req.method !== 'PATCH' || !id) throw new ShopError('Thao tác không hỗ trợ.', 405);
        const staff = db.prepare("SELECT id FROM members WHERE id=? AND role='staff' AND demo=0").bind(id).first();
        if (!staff) throw new ShopError('Chỉ cấp quyền cho nhân viên.', 404);
        db.prepare('INSERT INTO product_edit_grants (member_id,can_edit,granted_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET can_edit=excluded.can_edit,granted_by=excluded.granted_by,updated_at=excluded.updated_at').bind(id, body.can_edit ? 1 : 0, u.id, nowIso()).run();
        return json({ ok: true });
    }
    if (area === 'products') {
        if (id === 'size-guide' && req.method === 'POST') {
            const productId = textValue(body.product_id, 120);
            const row = await db.prepare('SELECT * FROM products WHERE id=? AND active=1').bind(productId).first<any>();
            if (!row) throw new ShopError('Không tìm thấy sản phẩm để gợi ý size.', 404);
            const recommendation = getSizeRecommendation({
                id: row.id,
                category: row.category,
                sizes: JSON.parse(row.sizes || '[]'),
                measurements: {
                    chest: Object.fromEntries((JSON.parse(row.sizes || '[]')).map((size: string) => [size, 86 + (['S', 'M', 'L', 'XL'].indexOf(size) + 1) * 8])),
                    height: Object.fromEntries((JSON.parse(row.sizes || '[]')).map((size: string) => [size, 160 + (['S', 'M', 'L', 'XL'].indexOf(size) + 1) * 8])),
                },
            }, {
                heightCm: Number(body.height_cm ?? 0) || null,
                weightKg: Number(body.weight_kg ?? 0) || null,
                fit: ['ôm', 'vừa', 'rộng'].includes(String(body.fit || 'vừa')) ? String(body.fit || 'vừa') as any : 'vừa',
                chestCm: Number(body.chest_cm ?? 0) || null,
                waistCm: Number(body.waist_cm ?? 0) || null,
                shoulderCm: Number(body.shoulder_cm ?? 0) || null,
                notes: String(body.notes || ''),
            });
            return json(recommendation);
        }
        // Đường dẫn con (reviews/comments) do feature reviews xử lý.
        if (action && !['discontinue', 'restore'].includes(action)) return undefined;
        if (req.method === 'GET') {
            const manage = url.searchParams.get('manage') === '1';
            if (manage)
                requireRole(s, teamRoles);
            if (id) {
                const row = await db.prepare('SELECT * FROM products WHERE id=?' + (!manage ? ' AND active=1' : '')).bind(id).first();
                if (!row)
                    throw new ShopError('Không tìm thấy sản phẩm.', 404);
                const variants = await db.prepare('SELECT * FROM variants WHERE product_id=?').bind(id).all();
                const images = await db.prepare('SELECT id,path,sort_order,is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order ASC, created_at ASC').bind(id).all();
                return json({ ...productRow(row), variants: variants.results, images: images.results.length ? images.results : [{ id: '', path: (row as any).image, sort_order: 0, is_primary: 1 }] });
            }
            const rows = await db.prepare('SELECT * FROM products' + (!manage ? ' WHERE active=1' : '') + ' ORDER BY is_new DESC,rowid ASC').all();
            return json(rows.results.map(productRow));
        }
        const u = requireRole(s, teamRoles);
        const management = managementRoles.includes(u.role);
        // Ngừng bán mềm: active=0 nhưng giữ nguyên đơn hàng/biến thể/ảnh/đánh giá.
        if (req.method === 'DELETE' || (req.method === 'POST' && action === 'discontinue')) {
            requireRole(s, managementRoles);
            if (!id || !(await db.prepare('SELECT id FROM products WHERE id=?').bind(id).first())) throw new ShopError('Không tìm thấy sản phẩm.', 404);
            await db.batch([
                db.prepare('UPDATE products SET active=0 WHERE id=?').bind(id),
                db.prepare('DELETE FROM cart WHERE variant_id IN (SELECT id FROM variants WHERE product_id=?)').bind(id),
            ]);
            return json({ ok: true, active: 0 });
        }
        if (req.method === 'POST' && action === 'restore') {
            requireRole(s, managementRoles);
            const result = await db.prepare('UPDATE products SET active=1 WHERE id=?').bind(id).run();
            if (!result.meta.changes) throw new ShopError('Không tìm thấy sản phẩm.', 404);
            return json({ ok: true, active: 1 });
        }
        if (action) throw new ShopError('Thao tác không hỗ trợ.', 405);
        if (!['POST', 'PATCH'].includes(req.method))
            throw new ShopError('Thao tác không hỗ trợ.', 405);
        // Nhân viên chỉ được sửa (không tạo/xóa/bật tắt bán) khi được cấp quyền.
        if (!management) {
            if (req.method !== 'PATCH' || !id) throw new ShopError('Chỉ quản lý được thêm sản phẩm mới.', 403);
            if (!canEditProducts(db, u)) throw new ShopError('Bạn chưa được cấp quyền chỉnh sửa sản phẩm.', 403);
        }
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
        if (image.includes('..') || (!image.startsWith('/images/') && !image.startsWith('/uploads/products/') && !/^https:\/\//.test(image)))
            throw new ShopError('Ảnh sản phẩm cần là đường dẫn hợp lệ.');
        if (original && original < price)
            throw new ShopError('Giá gốc cần lớn hơn hoặc bằng giá bán.');
        const productId = id || crypto.randomUUID();
        const statements = [];
        let active = body.active === 0 ? 0 : 1;
        let imageFinal = image;
        if (id) {
            const current = await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first<any>();
            if (!current)
                throw new ShopError('Không tìm thấy sản phẩm.', 404);
            // PATCH không nói gì về active -> giữ nguyên (không vô tình bán lại sản phẩm đã ngừng).
            if (body.active === undefined || !management) active = current.active;
            // Ảnh chính do bộ sưu tập ảnh quyết định (uploads), không bị PATCH ghi đè.
            const primaryImage = db.prepare('SELECT path FROM product_images WHERE product_id=? AND is_primary=1').bind(id).first<{ path: string }>();
            if (primaryImage) imageFinal = primaryImage.path;
            const oldSizes = JSON.parse(current.sizes), oldColors = JSON.parse(current.colors);
            if (oldSizes.some((v: string) => !sizes.includes(v)) || oldColors.some((v: string) => !colors.includes(v)))
                throw new ShopError('Giữ các size và màu hiện có để bảo toàn đơn hàng. Bạn có thể thêm biến thể hoặc ẩn sản phẩm.');
        }
        statements.push(db.prepare('INSERT INTO products (id,name,category,gender,price,original_price,image,description,material,colors,sizes,is_new,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,gender=excluded.gender,price=excluded.price,original_price=excluded.original_price,image=excluded.image,description=excluded.description,material=excluded.material,colors=excluded.colors,sizes=excluded.sizes,is_new=excluded.is_new,active=excluded.active').bind(productId, name, category, gender, price, original, imageFinal, textValue(body.description, 2000), textValue(body.material, 150), JSON.stringify([...new Set(colors)]), JSON.stringify([...new Set(sizes)]), body.is_new ? 1 : 0, active));
        for (const size of sizes)
            for (const color of colors)
                statements.push(db.prepare('INSERT OR IGNORE INTO variants (id,product_id,size,color,stock) VALUES (?,?,?,?,?)').bind(productId + '-' + size + '-' + color, productId, size, color, id ? 0 : integerValue(body.stock ?? 10, 0, 100000)));
        await db.batch(statements);
        return json({ id: productId });
    }
    return undefined;
}
