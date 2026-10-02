import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const shop = sqliteTable('shop', { id: text('id').primaryKey(), owner_id: text('owner_id').notNull(), phone: text('phone').notNull().default(''), zalo: text('zalo').notNull().default(''), facebook: text('facebook').notNull().default(''), address: text('address').notNull().default(''), hours: text('hours').notNull().default('09:00 – 21:00, mỗi ngày') });
