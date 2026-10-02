import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { roleNames } from '../accounts/types';
import { ShopService } from '../../shop/shop.service';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { OrdersViewComponent } from '../orders/orders-view.component';
import { ProductManagementComponent } from '../products/product-management.component';
import { InventoryComponent } from '../inventory/inventory.component';
import { CouponManagementComponent } from '../coupons/coupon-management.component';
import { MemberManagementComponent } from '../accounts/member-management.component';
import { ShopSettingsComponent } from '../contacts/shop-settings.component';
import { IconsComponent } from '../../shared/icons.component';

type AdminTab = {
  id: string;
  label: string;
  icon: string;
  allowed: boolean;
};

@Component({
  selector: 'app-admin-area',
  standalone: true,
  imports: [
    EmptyComponent,
    LoaderComponent,
    DashboardComponent,
    OrdersViewComponent,
    ProductManagementComponent,
    InventoryComponent,
    CouponManagementComponent,
    MemberManagementComponent,
    ShopSettingsComponent,
    IconsComponent,
  ],
  template: `@if (!shop.loaded) {
      <app-loader />
    } @else if (!shop.session.user || shop.session.user.role === 'customer') {
      <main class="container section">
        <app-empty
          title="Khu vực dành cho đội ngũ cửa hàng"
          text="Tài khoản này không có quyền truy cập trang quản trị."
        >
          <button class="button black" (click)="shop.go('/tai-khoan')">Về tài khoản</button>
        </app-empty>
      </main>
    } @else {
      <main class="admin-shell">
        <aside class="admin-sidebar">
          <p class="eyebrow">M&A WORKSPACE</p>
          <h2>Quản lý cửa hàng</h2>
          <div class="admin-identity">
            <div class="avatar small-avatar">{{ shop.session.user!.name[0].toUpperCase() }}</div>
            <div>
              <strong>{{ shop.session.user!.name }}</strong
              ><span>{{ roleNames[shop.session.user!.role] }}</span>
            </div>
          </div>
          <nav aria-label="Khu vực quản lý">
            @for (t of allowedTabs; track t.id) {
              <button [class.active]="t.id === tab" (click)="shop.go('/quan-tri/' + t.id)">
                <app-icon [name]="t.icon" [size]="19" />{{ t.label }}
              </button>
            }
          </nav>
          <button class="back-store" (click)="shop.go('/')">
            <app-icon name="shopping-bag" [size]="17" />Về cửa hàng
          </button>
          <p class="admin-sample">Dữ liệu trải nghiệm<br />Chưa phát sinh giao dịch thật</p>
        </aside>
        <section class="admin-content">
          <header class="admin-page-heading">
            <div>
              <span class="eyebrow">M&A SHOP / {{ roleNames[shop.session.user!.role].toUpperCase() }}</span>
              <h1>{{ heading }}</h1>
            </div>
            <span class="pill">Bản trải nghiệm</span>
          </header>
          @if (!current?.allowed) {
            <app-empty title="Bạn không có quyền vào mục này" />
          } @else if (tab === 'tong-quan') {
            <app-dashboard />
          } @else if (tab === 'don-hang') {
            <app-orders-view [manage]="true" [user]="shop.session.user!" />
          } @else if (tab === 'san-pham') {
            <app-product-management />
          } @else if (tab === 'kho-hang') {
            <app-inventory [user]="shop.session.user!" />
          } @else if (tab === 'uu-dai') {
            <app-coupon-management />
          } @else if (tab === 'tai-khoan') {
            <app-member-management />
          } @else if (tab === 'cai-dat') {
            <app-shop-settings [settings]="shop.settings" />
          }
        </section>
      </main>
    }`,
})
export class AdminAreaComponent implements OnInit {
  shop = inject(ShopService);
  private route = inject(ActivatedRoute);
  roleNames = roleNames;
  tab = 'tong-quan';

  get user() {
    return this.shop.session.user!;
  }

  get manager() {
    return ['admin', 'manager'].includes(this.user.role);
  }

  ngOnInit() {
    this.route.paramMap.subscribe(() => this.syncTab());
    this.syncTab();
  }

  private syncTab() {
    this.tab = this.route.snapshot.paramMap.get('tab') || (this.manager ? 'tong-quan' : 'don-hang');
  }

  get tabs(): AdminTab[] {
    return [
      { id: 'tong-quan', label: 'Tổng quan', icon: 'layout-dashboard', allowed: this.manager },
      { id: 'don-hang', label: 'Đơn hàng', icon: 'shopping-basket', allowed: true },
      { id: 'san-pham', label: 'Sản phẩm', icon: 'package', allowed: this.manager },
      { id: 'kho-hang', label: 'Kho hàng', icon: 'boxes', allowed: true },
      { id: 'uu-dai', label: 'Mã ưu đãi', icon: 'tag', allowed: this.manager },
      { id: 'tai-khoan', label: 'Phân quyền', icon: 'users', allowed: this.user.role === 'admin' },
      { id: 'cai-dat', label: 'Thông tin shop', icon: 'settings', allowed: this.user.role === 'admin' },
    ];
  }

  get allowedTabs() {
    return this.tabs.filter((t) => t.allowed);
  }

  get current() {
    return this.tabs.find((t) => t.id === this.tab);
  }

  get heading() {
    return this.current?.label || 'Không tìm thấy trang';
  }
}
