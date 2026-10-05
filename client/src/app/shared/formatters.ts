export const money = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export const dateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '');

export const dateOnly = (d?: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

/** YYYY-MM-DD -> DD/MM/YYYY (không đổi múi giờ). */
export const ymdLabel = (ymd?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd || '';
};

/** Ngày hôm nay (YYYY-MM-DD) theo giờ Việt Nam, khớp với báo cáo phía máy chủ. */
export const todayVn = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
};
