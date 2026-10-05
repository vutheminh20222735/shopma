-- Backfill: COD đã giao trước đây được coi là đã thu tiền để báo cáo/đánh giá hoạt động.
UPDATE `orders` SET `payment_status`='paid' WHERE `status`='delivered' AND `payment`='cod' AND (`payment_status`='' OR `payment_status`='unpaid');
--> statement-breakpoint
-- Ghi nhận sự kiện ban đầu cho đơn chưa có timeline (không ghi đè lịch sử thật).
INSERT INTO `order_events` (`id`,`order_id`,`status`,`note`,`actor_id`,`actor_name`,`created_at`)
SELECT lower(hex(randomblob(16))), o.id, o.status, 'Đồng bộ từ dữ liệu cũ', '', 'Hệ thống', COALESCE(o.created_at, datetime('now'))
FROM `orders` o
WHERE NOT EXISTS (SELECT 1 FROM `order_events` e WHERE e.order_id = o.id);
