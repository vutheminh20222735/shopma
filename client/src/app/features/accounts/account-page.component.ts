import { Component, inject } from '@angular/core';
import { api } from '../../shared/api';
import { roleNames } from './types';
import { roles } from './constants';
import { ShopService } from '../../shop/shop.service';
import { AuthFormComponent } from './auth-form.component';
import { OrdersViewComponent } from '../orders/orders-view.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [AuthFormComponent, OrdersViewComponent, LoaderComponent, IconsComponent],
  template: `<main class="container section account-page">
    <div class="section-heading">
      <div>
        <p class="eyebrow">MY M&A</p>
        <h1>Tài khoản của bạn</h1>
      </div>
      @if (shop.isTeam) {
        <button class="button black" (click)="shop.go('/quan-tri')">
          <app-icon name="layout-dashboard" [size]="17" />Vào khu vực làm việc
        </button>
      }
    </div>
    @if (!shop.loaded) {
      <app-loader />
    } @else if (shop.session.user) {
      <div class="account-profile">
        <div class="avatar">{{ shop.session.user.name.slice(0, 1).toUpperCase() }}</div>
        <div>
          <h2>{{ shop.session.user.name }}</h2>
          <p>{{ shop.session.user.email }}</p>
          <span class="pill">{{ roleNames[shop.session.user.role] }}</span>
        </div>
      </div>
      @if (shop.session.canPreview) {
        <div class="role-preview">
          <h2>Trải nghiệm từng vai trò</h2>
          <p>Xem các màn hình và thao tác được phép của mỗi tài khoản.</p>
          <div class="role-cards">
            @for (role of roles; track role) {
              <button [disabled]="shop.busy" (click)="shop.switchRole(role)">
                <span>
                  @if (role === 'admin') {
                    <app-icon name="shield-check" />
                  } @else if (role === 'manager') {
                    <app-icon name="layout-dashboard" />
                  } @else if (role === 'staff') {
                    <app-icon name="package" />
                  } @else {
                    <app-icon name="shopping-bag" />
                  }
                </span>
                <strong>{{ roleNames[role] }}</strong>
                <small>{{
                  role === 'admin'
                    ? 'Toàn quyền cửa hàng'
                    : role === 'manager'
                      ? 'Sản phẩm, kho, đơn hàng'
                      : role === 'staff'
                        ? 'Xem kho, xử lý đơn'
                        : 'Mua sắm, theo dõi đơn'
                }}</small>
              </button>
            }
          </div>
        </div>
      }
      @if (shop.session.user) {
        <app-orders-view [manage]="false" [user]="shop.session.user" />
      }
      <button class="text-button signout" [disabled]="shop.busy" (click)="logout()">
        <app-icon name="log-out" [size]="17" />Đăng xuất
      </button>
    } @else {
      <app-auth-form />
    }
  </main>`,
})
export class AccountPageComponent {
  shop = inject(ShopService);
  roleNames = roleNames;
  roles = roles;

  logout() {
    void this.shop.run(async () => {
      await api('auth/logout', 'POST', {});
      await this.shop.reload();
      this.shop.go('/tai-khoan');
    }, 'Đã đăng xuất.');
  }
}
