import { Component, Input, inject } from '@angular/core';
import type { Product } from './types';
import { swatches } from './types';
import { ShopService } from '../../shop/shop.service';
import { PriceComponent } from '../../shared/ui/price.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [PriceComponent, IconsComponent],
  template: `<article class="product-card">
    <div class="product-visual">
      <a [href]="'/san-pham/' + p.id" (click)="nav($event, '/san-pham/' + p.id)"
        ><img [src]="p.image" [alt]="p.name" loading="lazy" [class]="'product-photo ' + p.id"
      /></a>
      <div class="product-tags">
        @if (p.is_new) {
          <span>MỚI</span>
        } @else if (p.original_price > p.price) {
          <span class="sale-tag">−{{ Math.round((1 - p.price / p.original_price) * 100) }}%</span>
        }
      </div>
      <button
        [class]="'heart-button' + (shop.favorites.includes(p.id) ? ' saved' : '')"
        [attr.aria-label]="(shop.favorites.includes(p.id) ? 'Bỏ lưu ' : 'Yêu thích ') + p.name"
        (click)="shop.favorite(p)"
      >
        <app-icon
          name="heart"
          [size]="19"
          [strokeWidth]="1.4"
          [fill]="shop.favorites.includes(p.id) ? 'currentColor' : 'none'"
        />
      </button>
      <a [href]="'/san-pham/' + p.id" class="quick-add" (click)="nav($event, '/san-pham/' + p.id)">Chọn size</a>
    </div>
    <div class="product-info">
      <span class="product-category">{{ p.gender }} · {{ p.category }}</span>
      <a [href]="'/san-pham/' + p.id" (click)="nav($event, '/san-pham/' + p.id)"><h3>{{ p.name }}</h3></a>
      <app-price [p]="p" />
      <div class="card-swatches">
        @for (c of p.colors; track c) {
          <span [title]="c" [style.background]="swatches[c] || '#aaa'"></span>
        }
        <span class="sizes-label">{{ p.sizes[0] }} – {{ p.sizes[p.sizes.length - 1] }}</span>
      </div>
    </div>
  </article>`,
})
export class ProductCardComponent {
  @Input({ required: true }) p!: Product;
  shop = inject(ShopService);
  swatches = swatches;
  Math = Math;

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
