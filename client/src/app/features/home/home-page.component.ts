import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { categories } from '../products/constants';
import { ProductCardComponent } from '../products/product-card.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ProductCardComponent, IconsComponent],
  template: `<main>
    <section class="hero">
      <img
        src="/images/hero-campaign.png"
        alt="Bộ sưu tập thời trang thường ngày M&A Shop"
        class="hero-image"
        fetchpriority="high"
      />
      <div class="hero-copy">
        <p class="eyebrow">THE EVERYDAY COLLECTION / 2026</p>
        <h1>Mặc điều<br />bạn thích<span>.</span></h1>
        <p>Những thiết kế dễ mặc.<br />Cho mỗi ngày là chính bạn.</p>
        <button class="button black" (click)="shop.navCatalog()">Khám phá bộ sưu tập</button>
      </div>
      <div class="hero-caption">M&A SHOP<span>EVERYDAY, YOUR WAY.</span></div>
      <span class="hero-index">01 / EVERYDAY</span>
    </section>
    <div class="benefit-strip">
      <span><app-icon name="truck" />Miễn phí giao hàng từ 699k</span>
      <span><app-icon name="package-check" />Hỗ trợ đổi size trong 7 ngày</span>
      <span><app-icon name="shield-check" />Kiểm tra hàng khi nhận</span>
    </div>
    <section class="section container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">CURATED FOR YOU</span>
          <h2>Mới trong tủ đồ</h2>
        </div>
        <button class="text-button" (click)="shop.navCatalog('Tất cả', 'new')">
          Xem tất cả <app-icon name="plus" [size]="16" />
        </button>
      </div>
      <div class="category-tabs">
        @for (c of tabCategories; track c) {
          <button [class.active]="shop.category === c" (click)="shop.category = c">{{ c }}</button>
        }
      </div>
      <div class="product-grid">
        @for (p of homeNew; track p.id) {
          <app-product-card [p]="p" />
        }
      </div>
    </section>
    <section class="collection-band container">
      <div>
        <span class="eyebrow">LESS, BUT BETTER</span>
        <h2>Đơn giản.<br />Theo cách của bạn.</h2>
        <p>Áo thun, sơ mi và những món đồ cơ bản<br />dễ kết hợp trong tủ đồ mỗi ngày.</p>
        <button class="button outline" (click)="shop.navCatalog('Unisex')">Khám phá Unisex</button>
      </div>
      <div class="collection-images">
        <img src="/images/knit.jpg" alt="Áo len dệt kim màu kem" loading="lazy" />
        <img src="/images/tee.jpg" alt="Áo thun cotton trắng" loading="lazy" />
      </div>
    </section>
    <section class="section container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">GOOD FINDS</span>
          <h2>Đẹp hơn, giá tốt hơn</h2>
        </div>
        <button class="text-button" (click)="shop.navCatalog('Tất cả', 'sale')">
          Xem ưu đãi <app-icon name="plus" [size]="16" />
        </button>
      </div>
      <div class="product-grid">
        @for (p of homeSale; track p.id) {
          <app-product-card [p]="p" />
        }
      </div>
    </section>
  </main>`,
})
export class HomePageComponent {
  shop = inject(ShopService);
  tabCategories = categories.slice(0, 6);

  get homeNew() {
    return this.shop.products
      .filter((p) => this.shop.category === 'Tất cả' || p.category === this.shop.category)
      .slice(0, 4);
  }

  get homeSale() {
    return this.shop.products.filter((p) => p.original_price > p.price).slice(0, 4);
  }
}
