CREATE TABLE IF NOT EXISTS `member_addresses` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `label` text NOT NULL DEFAULT '',
  `recipient_name` text NOT NULL,
  `phone` text NOT NULL,
  `address` text NOT NULL,
  `is_default` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_member_addresses_member` ON `member_addresses` (`member_id`);
