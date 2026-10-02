import { ensureCatalog } from './initialize';
import { getDb } from '../index';
await ensureCatalog();
getDb().close();
console.log('Đã khởi tạo bộ sưu tập và mã ưu đãi mẫu.');
