import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { variants } from '@database/schema/inventory';
export const cart = sqliteTable('cart', { id: text('id').primaryKey(), owner_id: text('owner_id').notNull(), variant_id: text('variant_id').notNull().references(() => variants.id), quantity: integer('quantity').notNull() }, t => [uniqueIndex('idx_cart_owner_variant').on(t.owner_id, t.variant_id), check('cart_valid_qty', sql `${t.quantity} > 0 AND ${t.quantity} <= 20`)]);
