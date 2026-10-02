import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const members = sqliteTable('members', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull(), role: text('role').notNull(), active: integer('active').notNull().default(1), demo: integer('demo').notNull().default(0) }, t => [uniqueIndex('idx_members_email').on(t.email)]);
export const previewSessions = sqliteTable('preview_sessions', { token: text('token').primaryKey(), actor_id: text('actor_id').notNull(), member_id: text('member_id').notNull(), expires_at: integer('expires_at').notNull() });
export const invitations = sqliteTable('invitations', { email: text('email').primaryKey(), name: text('name').notNull(), role: text('role').notNull(), active: integer('active').notNull().default(1) });

export const credentials = sqliteTable('credentials', { member_id: text('member_id').primaryKey().references(() => members.id), password_hash: text('password_hash').notNull(), password_plain: text('password_plain').notNull().default('') });
export const authSessions = sqliteTable('auth_sessions', { token_hash: text('token_hash').primaryKey(), member_id: text('member_id').notNull().references(() => members.id), expires_at: integer('expires_at').notNull() }, t => [index('idx_auth_sessions_member').on(t.member_id)]);
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    token_hash: text('token_hash').primaryKey(),
    member_id: text('member_id').notNull().references(() => members.id),
    expires_at: integer('expires_at').notNull(),
    used_at: integer('used_at'),
    code_hash: text('code_hash').notNull().default(''),
}, t => [index('idx_password_reset_member').on(t.member_id)]);
