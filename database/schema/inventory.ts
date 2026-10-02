import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { products } from '@database/schema/products';
export const variants = sqliteTable('variants', { id: text('id').primaryKey(), product_id: text('product_id').notNull().references(() => products.id), size: text('size').notNull(), color: text('color').notNull(), stock: integer('stock').notNull().default(10) }, t => [uniqueIndex('idx_variants_product_size_color').on(t.product_id, t.size, t.color), check('stock_nonnegative', sql `${t.stock} >= 0`)]);
