import { ShopError } from '@server/shared/errors';
import { requireRole, managementRoles } from '@server/features/accounts/server/session';
import { json } from '@server/shared/response';
import { addDays, daysBetween, isYmd, startOfDayIso, timezone, todayYmd, toYmd } from '@server/shared/time';
import type { ShopRequestContext } from '@server/shared/context';

type Granularity = 'day' | 'month' | 'year';
type Bucket = { period: string; orders: number; goods: number; discount: number; net_goods: number; shipping: number; total: number; refunds: number; pending_refunds: number; net_after_refunds: number };
const empty = (period: string): Bucket => ({ period, orders: 0, goods: 0, discount: 0, net_goods: 0, shipping: 0, total: 0, refunds: 0, pending_refunds: 0, net_after_refunds: 0 });
const bucketKey = (ymd: string, g: Granularity) => g === 'day' ? ymd : g === 'month' ? ymd.slice(0, 7) : ymd.slice(0, 4);
const firstOfMonth = (ymd: string, delta: number) => { const d = new Date(ymd.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 10); };
function listPeriods(from: string, to: string, g: Granularity) {
    const keys: string[] = [];
    if (g === 'day') for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
    else if (g === 'month') for (let d = from.slice(0, 7) + '-01'; d <= to; d = firstOfMonth(d, 1)) keys.push(d.slice(0, 7));
    else for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) keys.push(String(y));
    return keys;
}
const csvCell = (value: string | number) => {
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = "'" + text; // chống CSV injection
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

export async function reportsApi(ctx: ShopRequestContext): Promise<Response | undefined> {
    const { req, url, area, id, db, s } = ctx;
    if (area !== 'reports') return undefined;
    requireRole(s, managementRoles);
    if (req.method !== 'GET' || (id && id !== 'revenue')) throw new ShopError('Thao tác không hỗ trợ.', 405);

    // granularity=day|month|year (hoặc period=...), from/to = YYYY-MM-DD theo giờ Việt Nam (gồm cả hai đầu).
    const g = (url.searchParams.get('granularity') || url.searchParams.get('period') || 'day') as Granularity | 'custom';
    const granularity: Granularity = g === 'custom' ? 'day' : g;
    if (!['day', 'month', 'year'].includes(granularity)) throw new ShopError('Kỳ báo cáo không hợp lệ (day, month, year, custom).');
    const today = todayYmd();
    let from = url.searchParams.get('from') || '', to = url.searchParams.get('to') || '';
    if (from && !isYmd(from) || to && !isYmd(to)) throw new ShopError('Ngày cần có dạng YYYY-MM-DD.');
    to ||= today;
    from ||= granularity === 'day' ? addDays(to, -29) : granularity === 'month' ? firstOfMonth(to, -11) : `${Number(to.slice(0, 4)) - 4}-01-01`;
    if (from > to) throw new ShopError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    if (daysBetween(from, to) > 3660) throw new ShopError('Khoảng thời gian tối đa 10 năm.');

    const buckets = new Map<string, Bucket>(listPeriods(from, to, granularity).map(key => [key, empty(key)]));
    const lower = startOfDayIso(from), upper = startOfDayIso(addDays(to, 1));
    // Doanh thu = đơn đã giao VÀ đã thanh toán; tính theo thời điểm giao (sự kiện delivered), dự phòng ngày tạo đơn cũ.
    const rows = db.prepare(`SELECT o.id,o.subtotal,o.discount,o.shipping,o.total,COALESCE(e.at,o.created_at) AS at FROM orders o
        LEFT JOIN (SELECT order_id,MAX(created_at) AS at FROM order_events WHERE status='delivered' GROUP BY order_id) e ON e.order_id=o.id
        WHERE o.status='delivered' AND o.payment_status IN ('paid','refunded') AND COALESCE(e.at,o.created_at)>=? AND COALESCE(e.at,o.created_at)<?`).bind(lower, upper).all<any>().results;
    for (const row of rows) {
        const bucket = buckets.get(bucketKey(toYmd(row.at), granularity));
        if (!bucket) continue;
        bucket.orders++; bucket.goods += row.subtotal; bucket.discount += row.discount; bucket.shipping += row.shipping; bucket.total += row.total;
    }
    const refunds = db.prepare("SELECT amount,status,COALESCE(confirmed_at,created_at) AS at FROM order_refunds WHERE COALESCE(confirmed_at,created_at)>=? AND COALESCE(confirmed_at,created_at)<?").bind(lower, upper).all<any>().results;
    for (const refund of refunds) {
        const bucket = buckets.get(bucketKey(toYmd(refund.at), granularity));
        if (!bucket) continue;
        if (refund.status === 'confirmed') bucket.refunds += refund.amount; else bucket.pending_refunds += refund.amount;
    }
    const data = [...buckets.values()].map(b => ({ ...b, net_goods: b.goods - b.discount, net_after_refunds: b.total - b.refunds }));
    const totals = data.reduce((sum, b) => { for (const key of Object.keys(sum) as (keyof Bucket)[]) if (key !== 'period') (sum[key] as number) += b[key] as number; return sum; }, empty('total'));

    if (url.searchParams.get('format') === 'csv') {
        const header = ['Kỳ', 'Số đơn', 'Tiền hàng', 'Giảm giá', 'Hàng sau giảm', 'Phí vận chuyển', 'Tổng thu', 'Hoàn tiền đã xác nhận', 'Hoàn tiền đang chờ', 'Thu sau hoàn tiền'];
        const line = (b: Bucket) => [b.period, b.orders, b.goods, b.discount, b.net_goods, b.shipping, b.total, b.refunds, b.pending_refunds, b.net_after_refunds].map(csvCell).join(',');
        const csv = '\uFEFF' + [header.join(','), ...data.map(line), line({ ...totals, period: 'Tổng cộng' })].join('\r\n') + '\r\n';
        return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="doanh-thu-${granularity}-${from}_${to}.csv"`, 'Cache-Control': 'no-store' } });
    }
    return json({
        timezone, granularity, from, to, definition: 'Đơn đã giao và đã thanh toán; phí vận chuyển tách riêng; hoàn tiền trừ riêng.',
        // Không có giá vốn trong dữ liệu nên không tính lợi nhuận.
        profit_available: false,
        data, totals,
    });
}
