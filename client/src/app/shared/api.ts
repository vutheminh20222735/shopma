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
