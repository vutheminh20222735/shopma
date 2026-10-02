import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { api } from '../../shared/api';
import type { Product } from './types';
import { swatches } from './types';
import { ShopService } from '../../shop/shop.service';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { PriceComponent } from '../../shared/ui/price.component';
import { ProductCardComponent } from './product-card.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [EmptyComponent, LoaderComponent, PriceComponent, ProductCardComponent, IconsComponent],
  template: `@if (error) {
      <main class="container section">
        <app-empty [title]="error">
          <button class="button black" (click)="shop.go('/san-pham')">Xem bộ sưu tập</button>
        </app-empty>
      </main>
    } @else if (!p) {
      <main class="container section"><app-loader /></main>
    } @else {
      <main class="container section detail">
        <p class="breadcrumb">
          <a href="/" (click)="nav($event, '/')">Trang chủ</a> /
          <a href="/san-pham" (click)="nav($event, '/san-pham')">Sản phẩm</a> / {{ p.name }}
        </p>
        <div class="detail-grid">
          <div class="detail-image">
            <img [src]="p.image" [alt]="p.name" [class]="p.id" />
            @if (p.is_new === 1) {
              <span class="detail-new">NEW IN</span>
            }
          </div>
          <div class="detail-content">
            <p class="eyebrow">{{ p.gender.toUpperCase() }} / {{ p.category.toUpperCase() }}</p>
            <h1>{{ p.name }}</h1>
            <app-price [p]="p" />
            <p class="detail-description">{{ p.description }}</p>
            <div class="choice-block">
              <h3>
                Màu sắc: <span>{{ color }}</span>
              </h3>
              <div class="color-options">
                @for (c of p.colors; track c) {
                  <button
                    [title]="c"
                    [attr.aria-label]="'Màu ' + c"
                    [attr.aria-pressed]="c === color"
                    [class.selected]="color === c"
                    [style.background]="swatches[c] || '#ccc'"
                    (click)="setColor(c)"
                  ></button>
                }
              </div>
            </div>
            <div class="choice-block">
              <div class="choice-heading">
                <h3>
                  Kích cỡ: <span>{{ size || 'Chọn size' }}</span>
                </h3>
                <button class="text-button" (click)="shop.sizeGuide = true">Hướng dẫn size</button>
              </div>
              <div class="size-options">
                @for (s of p.sizes; track s) {
                  <button
                    [disabled]="!sizeAvailable(s)"
                    [class.selected]="size === s"
                    (click)="pickSize(s)"
                  >
                    {{ s }}
                  </button>
                }
              </div>
              <p class="stock-note">{{ stockNote }}</p>
            </div>
            <div class="buy-row">
              <div class="quantity">
                <button aria-label="Giảm số lượng" [disabled]="quantity === 1" (click)="quantity = quantity - 1">
                  <app-icon name="minus" [size]="16" />
                </button>
                <span>{{ quantity }}</span>
                <button
                  aria-label="Tăng số lượng"
                  [disabled]="!size || quantity >= Math.min(20, stock)"
                  (click)="quantity = quantity + 1"
                >
                  <app-icon name="plus" [size]="16" />
                </button>
              </div>
              <button class="button black" [disabled]="shop.busy || (!!size && !stock)" (click)="add()">
                <app-icon name="shopping-bag" [size]="18" />Thêm vào giỏ hàng
              </button>
              <button
                [class]="'icon-button detail-heart' + (shop.favorites.includes(p.id) ? ' saved' : '')"
                aria-label="Yêu thích sản phẩm"
                (click)="shop.favorite(p)"
              >
                <app-icon name="heart" [fill]="shop.favorites.includes(p.id) ? 'currentColor' : 'none'" />
              </button>
            </div>
            <div class="detail-services">
              <span><app-icon name="truck" [size]="18" />Miễn phí giao hàng từ 699.000đ</span>
              <span><app-icon name="package-check" [size]="18" />Đổi size trong 7 ngày</span>
            </div>
            <details open>
              <summary>Chất liệu & chăm sóc</summary>
              <p>{{ p.material }}. Giặt cùng màu, tránh nước nóng và phơi trong bóng râm.</p>
            </details>
            <details>
              <summary>Giao hàng & đổi trả</summary>
              <p>
                Phí giao hàng 30.000đ, miễn phí từ 699.000đ. Đơn đặt trên bản trải nghiệm chưa phát sinh
                thanh toán hoặc giao hàng thật.
              </p>
            </details>
            <p class="sample-caption">Ảnh và thông tin sản phẩm dùng để minh họa bộ sưu tập mẫu.</p>
          </div>
        </div>
        <section class="section">
          <div class="section-heading"><h2>Có thể bạn cũng thích</h2></div>
          <div class="product-grid">
            @for (v of related; track v.id) {
              <app-product-card [p]="v" />
            }
          </div>
        </section>
      </main>
    }`,
})
export class ProductDetailComponent implements OnInit {
  shop = inject(ShopService);
  private route = inject(ActivatedRoute);

  p: Product | null = null;
  error = '';
  color = '';
  size = '';
  quantity = 1;
  swatches = swatches;
  Math = Math;
  id = '';

  get stock() {
    return this.p?.variants?.find((v) => v.size === this.size && v.color === this.color)?.stock ?? 0;
  }

  get stockNote() {
    if (!this.size) return 'Chọn size để kiểm tra tồn kho';
    return this.stock ? `Còn ${this.stock} sản phẩm với lựa chọn này` : 'Size này tạm hết hàng';
  }

  get related() {
    return this.shop.products.filter((v) => v.id !== this.id).slice(0, 4);
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.id = params.get('id') || '';
      void this.loadProduct();
    });
  }

  async loadProduct() {
    this.p = null;
    this.size = '';
    this.error = '';
    try {
      const v = await api<Product>('products/' + this.id);
      this.p = v;
      this.color = v.colors[0];
      this.quantity = 1;
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  sizeAvailable(s: string) {
    return (this.p?.variants?.find((v) => v.size === s && v.color === this.color)?.stock ?? 0) > 0;
  }

  setColor(c: string) {
    this.color = c;
    this.clampQuantity();
  }

  pickSize(s: string) {
    this.size = s;
    this.quantity = 1;
    this.clampQuantity();
  }

  clampQuantity() {
    if (!this.p || !this.size) return;
    if (this.stock === 0) {
      this.size = '';
      this.quantity = 1;
    } else {
      this.quantity = Math.min(this.quantity, this.stock, 20);
    }
  }

  add() {
    if (!this.shop.session.user) {
      this.shop.go('/tai-khoan');
      return;
    }
    if (!this.p) return;
    void this.shop.run(async () => {
      if (!this.size) throw new Error('Chọn size trước khi thêm vào giỏ.');
      await api('cart', 'POST', {
        product_id: this.p!.id,
        size: this.size,
        color: this.color,
        quantity: this.quantity,
      });
      await this.shop.reload();
    }, 'Đã thêm vào giỏ hàng.');
  }

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
