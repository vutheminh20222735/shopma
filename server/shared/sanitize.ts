import { ShopError } from '@server/shared/errors';

const BLOCKED = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|form|svg|math|base|frame|frameset)\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]{3,}\s*=/i;
const entities: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
const decode = (value: string) => value
    .replace(/&(?:lt|gt|amp|quot|nbsp|#39|#x27);/gi, match => entities[match.toLowerCase()] ?? match)
    .replace(/&#(\d{1,6});/g, (_m, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, code) => String.fromCodePoint(Math.min(parseInt(code, 16), 0x10ffff)));

/** Có chứa thẻ/mã bị chặn (script, iframe, onerror=, javascript: ...) kể cả khi bị mã hóa HTML entity. */
export const hasBlockedMarkup = (raw: string) => BLOCKED.test(raw) || BLOCKED.test(decode(raw));

/** Chuyển về văn bản thuần: bỏ thẻ HTML, ký tự điều khiển, chuẩn hóa khoảng trắng. */
export function stripHtml(raw: string): string {
    let text = decode(String(raw ?? ''));
    text = text.replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/?[a-z!][^>]*>?/gi, ' ')
        .replace(/[<>]/g, '')
        .replace(/javascript\s*:|vbscript\s*:/gi, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '');
    return text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Kiểm tra spam đơn giản. Trả lý do (tiếng Việt) hoặc null nếu ổn. */
export function spamReason(text: string, min = 5): string | null {
    if (text.length < min) return `Nội dung cần từ ${min} ký tự trở lên.`;
    if (/(.)\1{7,}/u.test(text)) return 'Nội dung có ký tự lặp lại quá nhiều.';
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length >= 6 && new Set(words).size / words.length < 0.25) return 'Nội dung bị lặp từ quá nhiều.';
    if ((text.match(/https?:\/\/|www\./gi) || []).length > 2) return 'Nội dung chứa quá nhiều liên kết.';
    if (/(?:\d[\s.-]?){10,}/.test(text) && /(zalo|telegram|inbox|ib\s)/i.test(text)) return 'Nội dung có dấu hiệu quảng cáo.';
    return null;
}

/** Làm sạch + kiểm tra nội dung người dùng nhập (đánh giá/bình luận). Ném ShopError nếu không hợp lệ. */
export function cleanUserText(raw: unknown, options: { min?: number; max?: number } = {}): string {
    const { min = 5, max = 1000 } = options;
    if (typeof raw !== 'string') throw new ShopError('Nội dung không hợp lệ.');
    if (hasBlockedMarkup(raw)) throw new ShopError('Nội dung chứa mã hoặc thẻ không được phép.');
    const text = stripHtml(raw).slice(0, max);
    const reason = spamReason(text, min);
    if (reason) throw new ShopError(reason);
    return text;
}
