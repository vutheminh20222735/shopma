import { ShopError } from '@server/shared/errors';
import { requireRole, allRoles } from '@server/features/accounts/server/session';
import { textValue, integerValue } from '@server/shared/validation';
import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
import { randomBytes } from 'node:crypto';

export async function giftsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
  const { req, area, db, body, s } = ctx;
  if (area !== 'gifts') return undefined;

  if (req.method === 'POST' && !ctx.id) {
    const productId = textValue(body.product_id, 120);
    const product = db.prepare('SELECT id,name,price,image FROM products WHERE id=? AND active=1').bind(productId).first<any>();
    if (!product) throw new ShopError('Sản phẩm không còn khả dụng.', 404);
    const variantSize = textValue(body.size || 'M', 20);
    const variantColor = textValue(body.color || 'Đen', 40);
    const sender = textValue(body.sender_name || 'Người tặng', 120);
    const recipient = textValue(body.recipient_name || 'Người nhận', 120);
    const message = textValue(body.message || 'Chúc bạn luôn vui vẻ!', 500);
    const token = randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    db.prepare('INSERT INTO gift_boxes (id,product_id,variant_size,variant_color,sender_name,recipient_name,message,token,expires_at,status,created_at,updated_at,items_json,total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,? ,?,0)').bind(
      crypto.randomUUID(),
      product.id,
      variantSize,
      variantColor,
      sender,
      recipient,
      message,
      token,
      expiresAt,
      'pending',
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify({ product_id: product.id, size: variantSize, color: variantColor, price: product.price })
    ).run();
    return json({ ok: true, token, shareUrl: `/qua?token=${token}`, expiresAt, product: { id: product.id, name: product.name, price: product.price, image: product.image } });
  }

  if (req.method === 'GET' && ctx.id) {
    const token = textValue(ctx.id, 200);
    const gift = db.prepare('SELECT * FROM gift_boxes WHERE token=?').bind(token).first<any>();
    if (!gift) throw new ShopError('Link quà không tồn tại hoặc đã hết hạn.', 404);
    if (new Date(gift.expires_at).getTime() < Date.now()) throw new ShopError('Link quà đã hết hạn.', 410);
    const product = db.prepare('SELECT id,name,price,image,colors,sizes FROM products WHERE id=?').bind(gift.product_id).first<any>();
    return json({ gift, product, shareUrl: `/qua?token=${token}` });
  }

  if (req.method === 'POST' && ctx.id === 'confirm') {
    const token = textValue(body.token, 200);
    const gift = db.prepare('SELECT * FROM gift_boxes WHERE token=?').bind(token).first<any>();
    if (!gift) throw new ShopError('Link quà không hợp lệ.', 404);
    const product = db.prepare('SELECT id,name,price,image FROM products WHERE id=?').bind(gift.product_id).first<any>();
    const size = textValue(body.size || gift.variant_size, 20);
    const color = textValue(body.color || gift.variant_color, 40);
    const address = textValue(body.address || '', 500);
    if (!address) throw new ShopError('Vui lòng nhập địa chỉ nhận quà.');
    db.prepare('UPDATE gift_boxes SET variant_size=?,variant_color=?,address=?,status=?,updated_at=? WHERE id=?').bind(size, color, address, 'confirmed', new Date().toISOString(), gift.id).run();
    return json({ ok: true, giftId: gift.id, product, total: product.price, status: 'confirmed' });
  }

  if (req.method === 'GET' && area === 'gifts' && ctx.id === 'mine') {
    const u = requireRole(s, allRoles);
    const rows = db.prepare('SELECT * FROM gift_boxes WHERE sender_name=? ORDER BY created_at DESC LIMIT 20').bind(u.name || 'Người tặng').all<any>().results;
    return json(rows);
  }

  throw new ShopError('Không tìm thấy chức năng.', 404);
}
