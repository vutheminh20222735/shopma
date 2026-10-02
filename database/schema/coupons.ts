import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const coupons = sqliteTable('coupons', { code: text('code').primaryKey(), percent: integer('percent').notNull(), minimum: integer('minimum').notNull().default(0), active: integer('active').notNull().default(1) }, t => [check('valid_coupon_percent', sql `${t.percent} > 0 AND ${t.percent} <= 50`)]);
