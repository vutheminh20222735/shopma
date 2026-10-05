import { config } from '@server/shared/config';

// Múi giờ cửa hàng: Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè).
// Thời điểm lưu DB là ISO UTC (sắp xếp được theo chuỗi); ngày nghiệp vụ (YYYY-MM-DD) tính theo giờ Việt Nam.
const VN_OFFSET_MS = 7 * 3600000;
const DAY_MS = 86400000;
export const timezone = config.timezone;

export const nowIso = (now: Date = new Date()) => now.toISOString();
/** Chấp nhận ISO có/không 'Z' và dạng SQLite 'YYYY-MM-DD HH:MM:SS' (UTC). Trả NaN nếu rỗng/sai. */
export function parseTime(value: string | Date | null | undefined): number {
    if (value instanceof Date) return value.getTime();
    if (!value) return NaN;
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text + 'T00:00:00+07:00');
    const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(text) ? text.replace(' ', 'T') : text;
    return Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : normalized + 'Z');
}
/** Ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm. */
export function toYmd(value: string | Date | number = new Date()): string {
    const ms = typeof value === 'number' ? value : parseTime(value);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}
export const todayYmd = (now: Date = new Date()) => toYmd(now.getTime());
export const isYmd = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const ymdToUtc = (ymd: string) => Date.parse(ymd + 'T00:00:00Z');
export function addDays(ymd: string, days: number): string {
    return new Date(ymdToUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}
export const daysBetween = (fromYmd: string, toYmdValue: string) => Math.round((ymdToUtc(toYmdValue) - ymdToUtc(fromYmd)) / DAY_MS);
/** Thêm ngày vào một thời điểm ISO (UTC), trả ISO. */
export const addDaysIso = (iso: string | Date, days: number) => new Date(parseTime(iso) + days * DAY_MS).toISOString();
/** 00:00 giờ Việt Nam của ngày YYYY-MM-DD, dạng ISO UTC. */
export const startOfDayIso = (ymd: string) => new Date(Date.parse(ymd + 'T00:00:00+07:00')).toISOString();
/** Cuối ngày (= 00:00 ngày kế tiếp) giờ Việt Nam, dạng ISO UTC. */
export const endOfDayIso = (ymd: string) => startOfDayIso(addDays(ymd, 1));
export const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
/** Ngày kỷ niệm trong năm `year` của một ngày gốc (YYYY-MM-DD). 29/2 -> 28/2 nếu năm không nhuận. */
export function anniversaryDateForYear(baseYmd: string, year: number): string {
    const month = baseYmd.slice(5, 7);
    let day = baseYmd.slice(8, 10);
    if (month === '02' && day === '29' && !isLeapYear(year)) day = '28';
    return `${String(year).padStart(4, '0')}-${month}-${day}`;
}
/** Số năm tròn kể từ ngày tạo tài khoản (theo ngày kỷ niệm đã điều chỉnh 29/2). */
export function yearsSinceAccount(createdAt: string | null | undefined, today: string = todayYmd()): number {
    const created = toYmd(createdAt ?? '');
    if (!created) return 0;
    let years = Number(today.slice(0, 4)) - Number(created.slice(0, 4));
    if (years <= 0) return 0;
    if (today < anniversaryDateForYear(created, Number(today.slice(0, 4)))) years--;
    return Math.max(0, years);
}
