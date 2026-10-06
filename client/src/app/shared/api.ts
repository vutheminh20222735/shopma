export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/shop/' + path, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Không thể kết nối cửa hàng. Vui lòng tải lại trang hoặc đăng nhập lại.');
  }
  const result: any = await response.json();
  if (!response.ok) throw new Error(result.error || 'Không thể hoàn thành thao tác.');
  return result as T;
}

/** Tải tệp (ví dụ CSV) từ API; lỗi JSON của máy chủ được chuyển thành Error tiếng Việt. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch('/api/shop/' + path, { credentials: 'same-origin' });
  if (!response.ok) {
    let message = 'Không thể tải tệp. Vui lòng thử lại.';
    try {
      const result: any = await response.json();
      message = result.error || message;
    } catch {
      /* không phải JSON */
    }
    throw new Error(message);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] || 'bao-cao.csv' };
}

export function query(params: Record<string, unknown>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    const normalized = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? value
      : value instanceof Date
        ? value.toISOString()
        : String(value);
    q.set(key, normalized === true ? '1' : String(normalized));
  }
  const text = q.toString();
  return text ? '?' + text : '';
}
