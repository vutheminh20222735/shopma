import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { LogoComponent } from '../../shared/ui/logo.component';
import { IconsComponent } from '../../shared/icons.component';
import { FacebookIconComponent } from '../../shared/ui/facebook-icon.component';

@Component({
  selector: 'app-store-footer',
  standalone: true,
  imports: [LogoComponent, IconsComponent, FacebookIconComponent],
  template: `<section class="contact-band">
      <div class="container">
        <div>
          <h2>Tìm đúng size. Chọn đúng gu.</h2>
          <p>M&A sẵn sàng giúp bạn.</p>
        </div>
        <button class="button outline" (click)="shop.go('/lien-he')">
          Liên hệ với shop <app-icon name="message-circle" [size]="17" />
        </button>
      </div>
    </section>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-brand">
          <app-logo [light]="true" />
          <p>Những món đồ dễ mặc.<br />Những ngày là chính bạn.</p>
          <span class="sample-note">Bản trải nghiệm · Sản phẩm và đơn hàng mẫu</span>
        </div>
        <div>
          <h3>Khám phá</h3>
          <button (click)="shop.navCatalog('Nữ')">Thời trang nữ</button>
          <button (click)="shop.navCatalog('Nam')">Thời trang nam</button>
          <button (click)="shop.navCatalog('Unisex')">Unisex</button>
          <button (click)="shop.navCatalog('Tất cả', 'sale')">Ưu đãi</button>
        </div>
        <div>
          <h3>Chăm sóc khách hàng</h3>
          <a href="/tai-khoan" (click)="nav($event, '/tai-khoan')">Đơn hàng của tôi</a>
          <a href="/chinh-sach" (click)="nav($event, '/chinh-sach')">Giao hàng & đổi size</a>
          <button (click)="shop.sizeGuide = true">Hướng dẫn chọn size</button>
          <a href="/lien-he" (click)="nav($event, '/lien-he')">Liên hệ</a>
        </div>
        <div>
          <h3>Kết nối M&A</h3>
          @if (shop.settings.zalo) {
            <a [href]="shop.settings.zalo" target="_blank" rel="noopener noreferrer"
              ><app-icon name="message-circle" [size]="16" />Zalo</a
            >
          } @else {
            <button (click)="shop.go('/lien-he')"><app-icon name="message-circle" [size]="16" />Zalo · Chưa cập nhật</button>
          }
          @if (shop.settings.facebook) {
            <a [href]="shop.settings.facebook" target="_blank" rel="noopener noreferrer"
              ><app-facebook-icon [size]="16" />Facebook</a
            >
          } @else {
            <button (click)="shop.go('/lien-he')"><app-facebook-icon [size]="16" />Facebook · Chưa cập nhật</button>
          }
          @if (shop.settings.phone) {
            <a [href]="phoneHref"
              ><app-icon name="phone" [size]="16" />{{ shop.settings.phone }}</a
            >
          } @else {
            <button (click)="shop.go('/lien-he')"><app-icon name="phone" [size]="16" />SĐT · Chưa cập nhật</button>
          }
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© 2026 M&A Shop.</span>
        <button (click)="shop.go('/tai-khoan')">Tài khoản & khu vực làm việc</button>
        <span>MADE FOR EVERYDAY.</span>
      </div>
    </footer>`,
})
export class StoreFooterComponent {
  shop = inject(ShopService);

  get phoneHref() {
    return 'tel:' + this.shop.settings.phone.replace(/\s/g, '');
  }

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
