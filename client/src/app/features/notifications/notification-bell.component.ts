import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import type { AppNotification } from './types';
import { NotificationsService } from './notifications.service';
import { ShopService } from '../../shop/shop.service';
import { dateTime } from '../../shared/formatters';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [IconsComponent],
  template: `<div class="notif">
    <button
      class="icon-button notif-trigger"
      [attr.aria-label]="'Thông báo' + (n.unread ? ', ' + n.unread + ' chưa đọc' : '')"
      [attr.aria-expanded]="open"
      aria-haspopup="true"
      (click)="toggle()"
    >
      <app-icon name="bell" [size]="21" />
      @if (n.unread > 0) {
        <b>{{ n.unread > 99 ? '99+' : n.unread }}</b>
      }
    </button>
    @if (open) {
      <div class="notif-panel" role="region" aria-label="Danh sách thông báo">
        <div class="notif-head">
          <strong>Thông báo</strong>
          <span class="notif-live" [class.on]="n.connected" [title]="n.connected ? 'Đang nhận thông báo trực tiếp' : 'Mất kết nối trực tiếp, đang thử lại'">
            {{ n.connected ? 'Trực tiếp' : 'Đang nối lại…' }}
          </span>
          <button class="text-button" [disabled]="!n.unread" (click)="n.markAllRead()">Đọc tất cả</button>
        </div>
        @if (n.error) {
          <p class="form-error" role="alert">{{ n.error }}</p>
        }
        <ul class="notif-list">
          @for (item of n.items; track item.id) {
            <li [class.unread]="!item.read_at">
              <button (click)="openItem(item)">
                <span class="notif-dot" aria-hidden="true"></span>
                <span class="notif-text">
                  <strong>{{ item.title }}</strong>
                  @if (item.body) {
                    <span>{{ item.body }}</span>
                  }
                  <small class="muted">{{ date(item.created_at) }}</small>
                </span>
              </button>
              @if (!item.read_at) {
                <button class="text-button notif-read" (click)="n.markRead(item)">Đã đọc</button>
              }
            </li>
          } @empty {
            <li class="notif-empty muted">{{ n.loading ? 'Đang tải…' : 'Chưa có thông báo nào.' }}</li>
          }
        </ul>
      </div>
    }
  </div>`,
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  n = inject(NotificationsService);
  private shop = inject(ShopService);
  private host = inject(ElementRef<HTMLElement>);
  open = false;
  date = dateTime;

  ngOnInit() {
    this.n.start();
  }

  ngOnDestroy() {
    // Kết nối SSE do ShopShell quản lý theo phiên — không đóng khi rời khu quản trị.
  }

  toggle() {
    this.open = !this.open;
    if (this.open) void this.n.refresh();
  }

  openItem(item: AppNotification) {
    void this.n.markRead(item);
    this.open = false;
    this.n.openLink(item);
  }

  @HostListener('document:click', ['$event'])
  outside(e: Event) {
    if (this.open && !this.host.nativeElement.contains(e.target)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  escape() {
    this.open = false;
  }
}
