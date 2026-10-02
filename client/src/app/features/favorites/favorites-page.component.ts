import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { ProductCardComponent } from '../products/product-card.component';
import { EmptyComponent } from '../../shared/ui/empty.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [ProductCardComponent, EmptyComponent],
  template: `<main class="container section">
    <p class="eyebrow">YOUR PICKS</p>
    <h1>Sản phẩm yêu thích</h1>
    @if (shop.favorites.length) {
      <div class="product-grid">
        @for (p of favoriteProducts; track p.id) {
          <app-product-card [p]="p" />
        }
      </div>
    } @else {
      <app-empty
        title="Lưu lại món đồ bạn thích"
        text="Chạm vào trái tim trên sản phẩm để tìm lại dễ dàng."
      >
        <button class="button black" (click)="shop.navCatalog()">Khám phá bộ sưu tập</button>
      </app-empty>
    }
  </main>`,
})
export class FavoritesPageComponent {
  shop = inject(ShopService);

  get favoriteProducts() {
    return this.shop.products.filter((p) => this.shop.favorites.includes(p.id));
  }
}
