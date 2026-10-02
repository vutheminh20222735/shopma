import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../shop/shop.service';
import { LogoComponent } from '../../shared/ui/logo.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-store-header',
  standalone: true,
  imports: [FormsModule, LogoComponent, IconsComponent],
  template: `<div class="announcement">
      MỘT TỦ ĐỒ. NHIỀU PHONG CÁCH.<span>Miễn phí vận chuyển từ 699.000đ</span>
    </div>
    <header class="site-header">
      <div class="header-inner">
        <button
          class="icon-button menu-toggle"
          aria-label="Mở menu"
          [attr.aria-expanded]="shop.mobileMenu"
          (click)="shop.mobileMenu = !shop.mobileMenu"
        >
          <app-icon name="menu" />
        </button>
        <a class="brand" href="/" (click)="nav($event, '/')"><app-logo /></a>
        <nav class="main-nav" [class.open]="shop.mobileMenu" aria-label="Danh mục chính">
          <button (click)="shop.navCatalog('Nữ')">Nữ</button>
          <button (click)="shop.navCatalog('Nam')">Nam</button>
          <button (click)="shop.navCatalog('Unisex')">Unisex</button>
          <button (click)="shop.navCatalog('Tất cả', 'new')">Hàng mới</button>
          <button class="sale-nav" (click)="shop.navCatalog('Tất cả', 'sale')">Ưu đãi</button>
        </nav>
        <div class="header-actions">
          <form
            class="header-search"
            (submit)="$event.preventDefault(); shop.searchCatalog(shop.search)"
          >
            <input
              aria-label="Tìm kiếm sản phẩm"
              placeholder="Tìm món đồ bạn thích"
              [(ngModel)]="shop.search"
              name="headerSearch"
            />
            <button aria-label="Tìm kiếm" type="submit"><app-icon name="search" [size]="19" /></button>
          </form>
          <button class="icon-button mobile-search" aria-label="Tìm kiếm" (click)="shop.go('/san-pham')">
            <app-icon name="search" [size]="21" />
          </button>
          <button class="icon-button" aria-label="Tài khoản" (click)="shop.go('/tai-khoan')">
            <app-icon name="user-round" [size]="21" />
          </button>
          <button class="icon-button favorite-header" aria-label="Yêu thích" (click)="shop.go('/yeu-thich')">
            <app-icon name="heart" [size]="21" />@if (shop.favorites.length > 0) {
              <b>{{ shop.favorites.length }}</b>
            }
          </button>
          <button
            class="icon-button bag-icon"
            [attr.aria-label]="'Giỏ hàng ' + shop.cartCount + ' sản phẩm'"
            (click)="shop.go('/gio-hang')"
          >
            <app-icon name="shopping-bag" [size]="21" />@if (shop.cartCount > 0) {
              <b>{{ shop.cartCount }}</b>
            }
          </button>
        </div>
      </div>
    </header>`,
})
export class StoreHeaderComponent {
  shop = inject(ShopService);

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
