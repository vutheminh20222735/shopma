import { Injectable, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';
import type { AppNotification } from './types';
import { ShopService } from '../../shop/shop.service';

export const STREAM_URL = '/api/shop/notifications/stream';

export type OrderLiveUpdate = {
  id: string;
  status: string;
  version?: number;
  payment_status?: string;
  refund_status?: string;
};

/**
 * Thông báo: REST + SSE. Dùng chung cho nhân sự và khách.
 * Event `order_update` đẩy trạng thái đơn realtime (không cần reload).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private shop = inject(ShopService);
  private zone = inject(NgZone);

  items: AppNotification[] = [];
  unread = 0;
  loading = false;
  error = '';
  connected = false;

  /** Phát khi shop đổi trạng thái đơn của khách đang đăng nhập. */
  readonly orderUpdates = new Subject<OrderLiveUpdate>();
  /** Phát khi hỏi đáp sản phẩm có bình luận/trả lời mới. */
  readonly commentUpdates = new Subject<{ product_id: string }>();

  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 2000;
  private running = false;

  start() {
    if (this.running) return;
    if (!this.shop.session.user) return;
    this.running = true;
    void this.refresh();
    this.connect();
  }

  stop() {
    this.running = false;
    this.connected = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.source?.close();
    this.source = null;
  }

  /** Bật/tắt theo phiên đăng nhập hiện tại. */
  syncSession() {
    if (this.shop.session.user) this.start();
    else this.stop();
  }

  async refresh() {
    if (!this.shop.session.user) return;
    this.loading = true;
    try {
      const res = await this.shop.getNotifications({ limit: 30 });
      this.items = res.items;
      this.unread = res.unread;
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async markRead(n: AppNotification) {
    if (n.read_at) return;
    const previous = n.read_at;
    n.read_at = new Date().toISOString();
    this.unread = Math.max(0, this.unread - 1);
    try {
      await this.shop.markNotificationsRead([n.id]);
    } catch (e) {
      n.read_at = previous;
      this.unread += 1;
      this.shop.notify((e as Error).message, true);
    }
  }

  async markAllRead() {
    try {
      await this.shop.markNotificationsRead('all');
      const now = new Date().toISOString();
      for (const n of this.items) n.read_at ||= now;
      this.unread = 0;
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  linkFor(n: AppNotification) {
    const admin = /^\/quan-tri\?order=(.+)$/.exec(n.link || '');
    if (admin) return '/quan-tri/don-hang?order=' + admin[1];
    const account = /^\/tai-khoan\?order=(.+)$/.exec(n.link || '');
    if (account) return '/tai-khoan?order=' + account[1];
    return n.link;
  }

  /** Mở link thông báo; với #anchor thì cuộn tới phần hỏi đáp sau khi điều hướng. */
  openLink(n: AppNotification) {
    const link = this.linkFor(n);
    if (!link) return;
    const hashIdx = link.indexOf('#');
    if (hashIdx >= 0) {
      const path = link.slice(0, hashIdx);
      const hash = link.slice(hashIdx + 1);
      this.shop.go(path || '/');
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
      return;
    }
    this.shop.go(link);
  }

  private connect() {
    if (!this.running || typeof EventSource === 'undefined') return;
    this.source?.close();
    const source = new EventSource(STREAM_URL, { withCredentials: true });
    this.source = source;

    source.addEventListener('open', () => {
      this.zone.run(() => {
        this.connected = true;
        this.retryDelay = 2000;
      });
    });
    source.addEventListener('ready', (event) => {
      this.zone.run(() => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (typeof data.unread === 'number') this.unread = data.unread;
        } catch {
          /* bỏ qua */
        }
        void this.refresh();
      });
    });
    source.addEventListener('notification', (event) => {
      this.zone.run(() => {
        try {
          const n: AppNotification = JSON.parse((event as MessageEvent).data);
          if (this.items.some((x) => x.id === n.id)) return;
          this.items = [n, ...this.items].slice(0, 50);
          if (!n.read_at) this.unread += 1;
          this.shop.notify(n.title);
        } catch {
          /* bỏ qua */
        }
      });
    });
    source.addEventListener('order_update', (event) => {
      this.zone.run(() => {
        try {
          const update: OrderLiveUpdate = JSON.parse((event as MessageEvent).data);
          this.orderUpdates.next(update);
        } catch {
          /* bỏ qua */
        }
      });
    });
    source.addEventListener('comment_update', (event) => {
      this.zone.run(() => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as { product_id: string };
          if (data?.product_id) this.commentUpdates.next(data);
        } catch {
          /* bỏ qua */
        }
      });
    });
    source.addEventListener('error', () => {
      this.zone.run(() => {
        this.connected = false;
        if (source.readyState === EventSource.CLOSED) this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect() {
    if (!this.running || this.retryTimer) return;
    this.source?.close();
    this.source = null;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 60000);
  }
}
