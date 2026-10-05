-- members profile / verification / timestamps
ALTER TABLE `members` ADD `created_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `members` ADD `birthday` text;
--> statement-breakpoint
ALTER TABLE `members` ADD `birthday_updated_at` text;
--> statement-breakpoint
ALTER TABLE `members` ADD `phone_e164` text;
--> statement-breakpoint
ALTER TABLE `members` ADD `phone_verified` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `members` ADD `phone_verified_at` text;
--> statement-breakpoint
UPDATE `members` SET `created_at` = COALESCE(NULLIF(`created_at`,''), datetime('now')) WHERE `created_at` = '' OR `created_at` IS NULL;
--> statement-breakpoint

-- orders enrichment
ALTER TABLE `orders` ADD `coupon_code` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `offer_id` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_code` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` text NOT NULL DEFAULT 'unpaid';
--> statement-breakpoint
ALTER TABLE `orders` ADD `refund_status` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE `orders` ADD `confirmed_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `order_events` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `status` text NOT NULL,
  `note` text NOT NULL DEFAULT '',
  `actor_id` text NOT NULL DEFAULT '',
  `actor_name` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_events_order` ON `order_events` (`order_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `order_refunds` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `amount` integer NOT NULL,
  `status` text NOT NULL,
  `provider_ref` text NOT NULL DEFAULT '',
  `note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `confirmed_at` text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `member_id` text NOT NULL,
  `order_id` text NOT NULL,
  `rating` integer NOT NULL,
  `content` text NOT NULL DEFAULT '',
  `verified_purchase` integer NOT NULL DEFAULT 1,
  `hidden` integer NOT NULL DEFAULT 0,
  `hidden_reason` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_reviews_member_product` ON `product_reviews` (`member_id`,`product_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_reviews_product` ON `product_reviews` (`product_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `review_moderation_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `review_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `action` text NOT NULL,
  `reason` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `product_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `member_id` text NOT NULL,
  `parent_id` text NOT NULL DEFAULT '',
  `content` text NOT NULL,
  `is_staff_reply` integer NOT NULL DEFAULT 0,
  `hidden` integer NOT NULL DEFAULT 0,
  `hidden_reason` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_comments_product` ON `product_comments` (`product_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL DEFAULT '',
  `link` text NOT NULL DEFAULT '',
  `ref_key` text NOT NULL DEFAULT '',
  `read_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_notifications_ref` ON `notifications` (`member_id`,`type`,`ref_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_member` ON `notifications` (`member_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `offer_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `milestone` integer NOT NULL DEFAULT 0,
  `percent` integer NOT NULL,
  `max_discount` integer NOT NULL,
  `minimum` integer NOT NULL,
  `valid_days` integer NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_offer_configs_kind_milestone` ON `offer_configs` (`kind`,`milestone`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `offer_config_history` (
  `id` text PRIMARY KEY NOT NULL,
  `config_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `snapshot` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `member_offers` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `kind` text NOT NULL,
  `code` text NOT NULL,
  `percent` integer NOT NULL,
  `max_discount` integer NOT NULL,
  `minimum` integer NOT NULL,
  `starts_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `reserved_order_id` text NOT NULL DEFAULT '',
  `milestone` integer NOT NULL DEFAULT 0,
  `year_key` integer NOT NULL DEFAULT 0,
  `phone_key` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_member_offers_code` ON `member_offers` (`code`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_member_offers_welcome_phone` ON `member_offers` (`kind`,`phone_key`) WHERE `kind`='welcome' AND `phone_key`!='';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_member_offers_birthday_year` ON `member_offers` (`kind`,`phone_key`,`year_key`) WHERE `kind`='birthday' AND `phone_key`!='';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_member_offers_anniversary` ON `member_offers` (`member_id`,`kind`,`milestone`) WHERE `kind`='anniversary';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `benefit_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `claim_key` text NOT NULL,
  `kind` text NOT NULL,
  `member_id` text NOT NULL,
  `phone_key` text NOT NULL DEFAULT '',
  `year_key` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_benefit_claims_key` ON `benefit_claims` (`claim_key`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `phone_e164` text NOT NULL,
  `code_hash` text NOT NULL,
  `purpose` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `product_images` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `path` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `is_primary` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_product_images_product` ON `product_images` (`product_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `product_edit_grants` (
  `member_id` text PRIMARY KEY NOT NULL,
  `can_edit` integer NOT NULL DEFAULT 0,
  `granted_by` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_ref` text NOT NULL DEFAULT '',
  `amount` integer NOT NULL,
  `status` text NOT NULL,
  `raw` text NOT NULL DEFAULT '',
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_payment_tx_idem` ON `payment_transactions` (`provider`,`idempotency_key`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `shipping_shipments` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `provider` text NOT NULL,
  `tracking_code` text NOT NULL DEFAULT '',
  `status` text NOT NULL,
  `fee` integer NOT NULL DEFAULT 0,
  `cod_collected` integer NOT NULL DEFAULT 0,
  `raw` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `job_runs` (
  `name` text PRIMARY KEY NOT NULL,
  `last_run_at` text NOT NULL
);
--> statement-breakpoint

INSERT OR IGNORE INTO `offer_configs` (`id`,`kind`,`milestone`,`percent`,`max_discount`,`minimum`,`valid_days`,`active`,`updated_at`) VALUES
 ('cfg-welcome','welcome',0,5,30000,200000,30,1,datetime('now')),
 ('cfg-birthday','birthday',0,10,100000,500000,7,1,datetime('now')),
 ('cfg-anniv-1','anniversary',1,8,80000,400000,14,1,datetime('now')),
 ('cfg-anniv-2','anniversary',2,10,100000,500000,14,1,datetime('now')),
 ('cfg-anniv-3','anniversary',3,12,120000,600000,14,1,datetime('now'));
