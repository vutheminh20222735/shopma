CREATE TABLE `cart` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cart_valid_qty" CHECK("cart"."quantity" > 0 AND "cart"."quantity" <= 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cart_owner_variant` ON `cart` (`owner_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`code` text PRIMARY KEY NOT NULL,
	`percent` integer NOT NULL,
	`minimum` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "valid_coupon_percent" CHECK("coupons"."percent" > 0 AND "coupons"."percent" <= 50)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_owner_product` ON `favorites` (`owner_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`note` text NOT NULL,
	`total` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`shipping` integer NOT NULL,
	`discount` integer NOT NULL,
	`status` text NOT NULL,
	`payment` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text NOT NULL,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_customer_key` ON `orders` (`customer_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_orders_created` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `preview_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`gender` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer DEFAULT 0 NOT NULL,
	`image` text NOT NULL,
	`description` text NOT NULL,
	`material` text NOT NULL,
	`colors` text NOT NULL,
	`sizes` text NOT NULL,
	`is_new` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "product_positive_price" CHECK("products"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE `shop` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`zalo` text DEFAULT '' NOT NULL,
	`facebook` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`hours` text DEFAULT '09:00 – 21:00, mỗi ngày' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`size` text NOT NULL,
	`color` text NOT NULL,
	`stock` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("variants"."stock" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_variants_product_size_color` ON `variants` (`product_id`,`size`,`color`);