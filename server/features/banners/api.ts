import { json } from '@server/shared/response';
import type { ShopRequestContext } from '@server/shared/context';
import { ShopError } from '@server/shared/errors';
import { requireRole, managementRoles } from '@server/features/accounts/server/session';
import { textValue, integerValue } from '@server/shared/validation';
import { randomUUID } from 'node:crypto';

export const defaultBanners = [
  { id: 'everyday', title: 'EVERYDAY', subtitle: 'Mặc điều bạn thích', description: 'Phong cách đậm chất tối giản cho mọi ngày.', image: '/images/hero-campaign.png', mobile_image: '/images/hero-campaign.png', href: '/san-pham?gender=T%E1%BA%A5t%20c%E1%83%A3&mode=all', active: 1, sort_order: 1, button_label: 'Khám phá bộ sưu tập' },
  { id: 'nu', title: 'Nữ', subtitle: 'Chạm nhẹ, dám nổi bật', description: 'Các set đồ nữ phù hợp đi làm và đi chơi.', image: '/images/dress.jpg', mobile_image: '/images/knit.jpg', href: '/san-pham?gender=N%E1%BB%AF', active: 1, sort_order: 2, button_label: 'Xem thời trang nữ' },
  { id: 'nam', title: 'Nam', subtitle: 'Clean & tự tin', description: 'Mẫu áo sơ mi, blazer dễ phối và dễ mặc.', image: '/images/shirt.jpg', mobile_image: '/images/tee.jpg', href: '/san-pham?gender=Nam', active: 1, sort_order: 3, button_label: 'Xem thời trang nam' },
  { id: 'unisex', title: 'Unisex', subtitle: 'Cùng mặc, cùng phong cách', description: 'Phom nâng tầm cho cả gia đình và bạn thân.', image: '/images/jeans.jpg', mobile_image: '/images/pants.jpg', href: '/san-pham?gender=Unisex', active: 1, sort_order: 4, button_label: 'Khám phá Unisex' },
  { id: 'new', title: 'Bộ sưu tập mới', subtitle: 'Mới trong tủ đồ', description: 'Những món phải có cho tháng mới.', image: '/images/blazer.jpg', mobile_image: '/images/tee.jpg', href: '/san-pham?mode=new', active: 1, sort_order: 5, button_label: 'Xem bộ mới' },
];

function normalizeBanner(row: any) {
  return {
    ...row,
    id: row.id,
    title: row.title || 'Bộ sưu tập',
    subtitle: row.subtitle || '',
    description: row.description || '',
    image: row.image || '/images/hero-campaign.png',
    mobile_image: row.mobile_image || row.image || '/images/hero-campaign.png',
    href: row.href || '/san-pham',
    button_label: row.button_label || 'Khám phá',
    active: row.active === 0 ? 0 : 1,
    sort_order: Number(row.sort_order || 0),
  };
}

export async function bannersApi(ctx: ShopRequestContext): Promise<Response | undefined> {
  const { req, area, id, db, s, body, url } = ctx;
  if (area !== 'banners') return undefined;

  if (req.method === 'GET') {
    const all = url.searchParams.get('all') === '1';
    const rows = db.prepare('SELECT * FROM site_banners ORDER BY sort_order ASC, created_at DESC').all<any>().results.map(normalizeBanner);
    if (!all) return json(rows.filter((banner) => Number(banner.active) === 1).length ? rows.filter((banner) => Number(banner.active) === 1) : defaultBanners.map(normalizeBanner));
    return json(rows.length ? rows : defaultBanners.map(normalizeBanner));
  }

  requireRole(s, managementRoles);

  if (req.method === 'POST' && !id) {
    const title = textValue(body.title, 120);
    const subtitle = textValue(body.subtitle || '', 120);
    const description = textValue(body.description || '', 500);
    const href = textValue(body.href || '/san-pham', 500);
    const image = textValue(body.image || body.desktop_image || '/images/hero-campaign.png', 1000);
    const mobileImage = textValue(body.mobile_image || image, 1000);
    const buttonLabel = textValue(body.button_label || 'Khám phá', 50);
    const sortOrder = integerValue(body.sort_order ?? 0, -1000, 1000);
    const active = body.active === 0 || body.active === false ? 0 : 1;
    const bannerId = id || randomUUID();
    db.prepare('INSERT INTO site_banners (id,title,subtitle,description,image,mobile_image,href,active,sort_order,button_label,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(bannerId, title, subtitle, description, image, mobileImage, href, active, sortOrder, buttonLabel, new Date().toISOString()).run();
    return json({ ok: true, id: bannerId });
  }

  if (!id) throw new ShopError('Không tìm thấy banner.', 404);
  const current = db.prepare('SELECT * FROM site_banners WHERE id=?').bind(id).first<any>();
  if (!current) throw new ShopError('Không tìm thấy banner.', 404);

  if (req.method === 'PATCH') {
    const title = body.title === undefined ? current.title : textValue(body.title, 120);
    const subtitle = body.subtitle === undefined ? current.subtitle : textValue(body.subtitle || '', 120);
    const description = body.description === undefined ? current.description : textValue(body.description || '', 500);
    const href = body.href === undefined ? current.href : textValue(body.href || '/san-pham', 500);
    const image = body.image === undefined && body.desktop_image === undefined ? current.image : textValue(body.image || body.desktop_image || current.image, 1000);
    const mobileImage = body.mobile_image === undefined ? (current.mobile_image || image) : textValue(body.mobile_image || image, 1000);
    const buttonLabel = body.button_label === undefined ? (current.button_label || 'Khám phá') : textValue(body.button_label || 'Khám phá', 50);
    const sortOrder = body.sort_order === undefined ? Number(current.sort_order || 0) : integerValue(body.sort_order, -1000, 1000);
    const active = body.active === undefined ? Number(current.active || 0) : (body.active === 0 || body.active === false ? 0 : 1);
    db.prepare('UPDATE site_banners SET title=?,subtitle=?,description=?,image=?,mobile_image=?,href=?,active=?,sort_order=?,button_label=?,updated_at=? WHERE id=?').bind(title, subtitle, description, image, mobileImage, href, active, sortOrder, buttonLabel, new Date().toISOString(), id).run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    db.prepare('DELETE FROM site_banners WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  throw new ShopError('Thao tác không hỗ trợ.', 405);
}
