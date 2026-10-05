import { Component, DoCheck, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { roleNames } from '../accounts/types';
import { ShopService } from '../../shop/shop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StoreHeaderComponent } from './store-header.component';
import { StoreFooterComponent } from './store-footer.component';
import { ContactLauncherComponent } from '../contacts/contact-launcher.component';
import { SizeGuideComponent } from '../products/size-guide.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-shop-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    StoreHeaderComponent,
    StoreFooterComponent,
    ContactLauncherComponent,
    SizeGuideComponent,
    IconsComponent,
  ],
  template: `<app-store-header />
    @if (shop.session.preview && shop.session.user) {
      <div class="preview-bar">
        <span
          >Đang trải nghiệm: <strong>{{ roleNames[shop.session.user.role] }}</strong></span
        >
        <button (click)="shop.switchRole('exit')">Về chủ shop <app-icon name="log-out" [size]="14" /></button>
      </div>
    }
    @if (shop.loadError) {
      <div class="error-banner" role="alert">
        {{ shop.loadError }}<button (click)="shop.reload()">Thử lại</button>
      </div>
    }
    <router-outlet />
    @if (!isAdmin) {
      <app-store-footer />
    }
    <app-contact-launcher />
    @if (shop.notice) {
      <div [class]="'toast' + (shop.notice.error ? ' error' : '')" [attr.role]="shop.notice.error ? 'alert' : 'status'">
        @if (shop.notice.error) {
          <app-icon name="x" [size]="18" />
        } @else {
          <app-icon name="check" [size]="18" />
        }
        <span>{{ shop.notice.text }}</span>
        <button (click)="shop.clearNotice()" aria-label="Đóng thông báo">
          <app-icon name="x" [size]="16" />
        </button>
      </div>
    }
    @if (shop.sizeGuide) {
      <app-size-guide />
    }`,
})
export class ShopShellComponent implements DoCheck {
  shop = inject(ShopService);
  private notifications = inject(NotificationsService);
  private router = inject(Router);
  roleNames = roleNames;
  private lastUserId: string | null | undefined;

  get isAdmin() {
    return this.router.url.startsWith('/quan-tri');
  }

  ngDoCheck() {
    const id = this.shop.session.user?.id ?? null;
    if (id !== this.lastUserId) {
      this.lastUserId = id;
      this.notifications.syncSession();
    }
  }
}
