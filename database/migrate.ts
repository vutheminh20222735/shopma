import { getDb } from './index';
getDb().close();
console.log('Đã áp dụng các migration chưa chạy.');
