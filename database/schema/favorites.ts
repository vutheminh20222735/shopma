import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const favorites = sqliteTable('favorites', { id: text('id').primaryKey(), owner_id: text('owner_id').notNull(), product_id: text('product_id').notNull() }, t => [uniqueIndex('idx_favorites_owner_product').on(t.owner_id, t.product_id)]);
