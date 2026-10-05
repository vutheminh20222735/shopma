import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ShopDatabase } from '@database/index';
import { ShopError } from '@server/shared/errors';
import { config } from '@server/shared/config';
import { textValue } from '@server/shared/validation';
import { requireRole, teamRoles, managementRoles } from '@server/features/accounts/server/session';
import { inTransaction, newId } from '@server/shared/transaction';
import { nowIso } from '@server/shared/time';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';

export type ImageKind = { mime: string; ext: string };
/** Xác định loại ảnh theo magic bytes (JPEG/PNG/WebP). Không tin Content-Type/đuôi file do client gửi. */
export function detectImage(buffer: Buffer): ImageKind | null {
    if (buffer.length < 32) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
    return null;
}
/** Giải mã data URL base64, kiểm tra kích thước và magic bytes. */
export function decodeImageDataUrl(value: unknown): { buffer: Buffer; kind: ImageKind } {
    if (typeof value !== 'string') throw new ShopError('Thiếu dữ liệu ảnh.');
    if (value.length > Math.ceil(config.maxImageBytes * 4 / 3) + 128) throw new ShopError('Ảnh vượt quá 5MB.', 413);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new ShopError('Ảnh cần là data URL base64 dạng JPEG, PNG hoặc WebP.');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > config.maxImageBytes) throw new ShopError('Ảnh vượt quá 5MB.', 413);
    const kind = detectImage(buffer);
    if (!kind) throw new ShopError('Tệp không phải ảnh JPEG, PNG hoặc WebP hợp lệ.');
    if (kind.mime !== match[1]) throw new ShopError('Định dạng ảnh không khớp với nội dung tệp.');
    return { buffer, kind };
}
export function canEditProducts(db: ShopDatabase, user: { id: string; role: string }) {
    if (managementRoles.includes(user.role as any)) return true;
    if (user.role !== 'staff') return false;
    return !!db.prepare('SELECT 1 AS ok FROM product_edit_grants WHERE member_id=? AND can_edit=1').bind(user.id).first();
}
const uploadFolder = () => path.join(config.uploadDir, 'products');
const removeFile = async (publicPath: string) => {
    if (!publicPath.startsWith('/uploads/products/')) return;
    try { await unlink(path.join(uploadFolder(), path.basename(publicPath))); } catch { /* file đã mất */ }
};

export async function uploadsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, area, id, action, db, s, body } = ctx;
    if (area !== 'uploads') return undefined;
    const u = requireRole(s, teamRoles);
    if (!canEditProducts(db, u)) throw new ShopError('Bạn chưa được cấp quyền chỉnh sửa sản phẩm.', 403);

    if (req.method === 'POST' && id && !action) {
        const product = db.prepare('SELECT id,image FROM products WHERE id=?').bind(id).first<{ id: string; image: string }>();
        if (!product) throw new ShopError('Không tìm thấy sản phẩm.', 404);
        const existing = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id=?').bind(id).first<{ n: number }>()?.n || 0;
        if (existing >= config.maxImagesPerProduct) throw new ShopError(`Mỗi sản phẩm tối đa ${config.maxImagesPerProduct} ảnh.`);
        const { buffer, kind } = decodeImageDataUrl(body.data_url);
        await mkdir(uploadFolder(), { recursive: true });
        const file = `${randomUUID()}.${kind.ext}`;
        const publicPath = `/uploads/products/${file}`;
        await writeFile(path.join(uploadFolder(), file), buffer, { flag: 'wx', mode: 0o644 });
        const imageId = newId();
        try {
            const result = inTransaction(db, () => {
                const rows = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id=?').bind(id).first<{ n: number }>()!.n;
                if (rows >= config.maxImagesPerProduct) throw new ShopError(`Mỗi sản phẩm tối đa ${config.maxImagesPerProduct} ảnh.`);
                const now = nowIso();
                if (rows === 0 && product.image) db.prepare('INSERT INTO product_images (id,product_id,path,sort_order,is_primary,created_at) VALUES (?,?,?,0,1,?)').bind(newId(), id, product.image, now).run();
                const primary = body.primary === true || (rows === 0 && !product.image);
                if (primary) db.prepare('UPDATE product_images SET is_primary=0 WHERE product_id=?').bind(id).run();
                const order = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM product_images WHERE product_id=?').bind(id).first<{ n: number }>()!.n;
                db.prepare('INSERT INTO product_images (id,product_id,path,sort_order,is_primary,created_at) VALUES (?,?,?,?,?,?)').bind(imageId, id, publicPath, order, primary ? 1 : 0, now).run();
                if (primary) db.prepare('UPDATE products SET image=? WHERE id=?').bind(publicPath, id).run();
                return { primary };
            });
            return json({ id: imageId, path: publicPath, is_primary: result.primary }, 201);
        } catch (error) {
            await removeFile(publicPath);
            throw error;
        }
    }

    if (req.method === 'POST' && id && action === 'primary') {
        const imageId = textValue(body.image_id, 80);
        inTransaction(db, () => {
            const image = db.prepare('SELECT * FROM product_images WHERE id=? AND product_id=?').bind(imageId, id).first<any>();
            if (!image) throw new ShopError('Không tìm thấy ảnh.', 404);
            db.prepare('UPDATE product_images SET is_primary=CASE WHEN id=? THEN 1 ELSE 0 END WHERE product_id=?').bind(imageId, id).run();
            db.prepare('UPDATE products SET image=? WHERE id=?').bind(image.path, id).run();
        });
        return json({ ok: true });
    }

    if (req.method === 'POST' && id && action === 'reorder') {
        if (!Array.isArray(body.image_ids) || !body.image_ids.length) throw new ShopError('Danh sách ảnh không hợp lệ.');
        const ids = body.image_ids.map((v: unknown) => textValue(v, 80));
        inTransaction(db, () => {
            const existing = db.prepare('SELECT id FROM product_images WHERE product_id=?').bind(id).all<{ id: string }>().results.map(r => r.id);
            if (existing.length !== ids.length || ids.some((imageId: string) => !existing.includes(imageId)))
                throw new ShopError('Danh sách ảnh không khớp sản phẩm.');
            ids.forEach((imageId: string, index: number) => {
                db.prepare('UPDATE product_images SET sort_order=? WHERE id=? AND product_id=?').bind(index, imageId, id).run();
            });
        });
        return json({ ok: true });
    }

    if (req.method === 'DELETE' && id && !action) {
        const removed = inTransaction(db, () => {
            const image = db.prepare('SELECT * FROM product_images WHERE id=?').bind(id).first<any>();
            if (!image) throw new ShopError('Không tìm thấy ảnh.', 404);
            const rest = db.prepare('SELECT * FROM product_images WHERE product_id=? AND id!=? ORDER BY sort_order ASC, created_at ASC').bind(image.product_id, id).all<any>().results;
            if (!rest.length) throw new ShopError('Sản phẩm cần có ít nhất một ảnh.');
            db.prepare('DELETE FROM product_images WHERE id=?').bind(id).run();
            if (image.is_primary) {
                db.prepare('UPDATE product_images SET is_primary=1 WHERE id=?').bind(rest[0].id).run();
                db.prepare('UPDATE products SET image=? WHERE id=?').bind(rest[0].path, image.product_id).run();
            }
            return image.path as string;
        });
        await removeFile(removed);
        return json({ ok: true });
    }
    throw new ShopError('Thao tác không hỗ trợ.', 405);
}
