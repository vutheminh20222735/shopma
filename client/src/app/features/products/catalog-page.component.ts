import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../shop/shop.service';
import { categories } from './constants';
import { ProductCardComponent } from './product-card.component';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { FilterComponent } from '../../shared/ui/filter.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [FormsModule, ProductCardComponent, EmptyComponent, FilterComponent, IconsComponent],
  template: `<main class="container catalog section">
    <p class="breadcrumb">
      <a href="/" (click)="nav($event, '/')">Trang chủ</a> / Bộ sưu tập
    </p>
    <div class="catalog-title">
      <div>
        <p class="eyebrow">M&A WARDROBE</p>
        <h1>{{ catalogTitle }}</h1>
        <p>{{ shop.filteredProducts.length }} món đồ @if (shop.search) {
          cho “{{ shop.search }}”
        }</p>
      </div>
      <button
        class="button outline filter-mobile"
        [attr.aria-expanded]="shop.filterOpen"
        (click)="shop.filterOpen = !shop.filterOpen"
      >
        <app-icon name="sliders-horizontal" [size]="17" />Bộ lọc
      </button>
    </div>
    <div class="catalog-layout">
      <aside class="filters" [class.open]="shop.filterOpen">
        <div class="filter-heading">
          <h3>Bộ lọc</h3>
          <button class="text-button" (click)="shop.navCatalog()">Xóa bộ lọc</button>
        </div>
        <form class="catalog-search" (submit)="$event.preventDefault()">
          <app-icon name="search" [size]="18" />
          <input
            aria-label="Tìm trong bộ sưu tập"
            placeholder="Tên sản phẩm…"
            [(ngModel)]="shop.search"
            name="catalogSearch"
          />
        </form>
        <app-filter label="Danh mục" [values]="categories" [value]="shop.category" (set)="shop.category = $event" />
        <app-filter
          label="Dành cho"
          [values]="genderOptions"
          [value]="shop.gender"
          (set)="shop.gender = $event"
        />
        <div class="filter-block">
          <h4>Kích cỡ</h4>
          <div class="size-options">
            @for (s of sizeOptions; track s) {
              <button [class.selected]="shop.sizeFilter === s" (click)="shop.sizeFilter = s">{{ s }}</button>
            }
          </div>
        </div>
        <div class="filter-block">
          <h4>Khoảng giá</h4>
          @for (opt of priceOptions; track opt[0]) {
            <label class="check-label"
              ><input
                type="radio"
                name="price"
                [checked]="shop.priceFilter === opt[0]"
                (change)="shop.priceFilter = opt[0]"
              />{{ opt[1] }}</label
            >
          }
        </div>
      </aside>
      <div class="catalog-results">
        <div class="results-bar">
          <span>{{ shop.filteredProducts.length }} sản phẩm</span>
          <label
            >Sắp xếp
            <select aria-label="Sắp xếp sản phẩm" [(ngModel)]="shop.sort" name="sort">
              <option value="new">Mới nhất</option>
              <option value="asc">Giá tăng dần</option>
              <option value="desc">Giá giảm dần</option>
            </select>
          </label>
        </div>
        @if (shop.filteredProducts.length) {
          <div class="product-grid catalog-grid">
            @for (p of visibleProducts; track p.id) {
              <app-product-card [p]="p" />
            }
          </div>
          @if (hasMoreProducts) {
            <div class="catalog-load-more">
              <button class="button outline" type="button" (click)="loadMore()">Xem thêm 5 sản phẩm</button>
            </div>
          }
        } @else {
          <app-empty
            title="Chưa tìm thấy món đồ phù hợp"
            text="Thử tên khác hoặc nới bộ lọc để xem thêm sản phẩm."
          >
            <button class="button black" (click)="shop.navCatalog()">Xem tất cả sản phẩm</button>
          </app-empty>
        }
      </div>
    </div>
  </main>`,
})
export class CatalogPageComponent {
  shop = inject(ShopService);
  categories = categories;
  genderOptions = ['Tất cả', 'Nữ', 'Nam', 'Unisex'];
  sizeOptions = ['Tất cả', 'S', 'M', 'L', 'XL', 'Freesize'];
  priceOptions: [string, string][] = [
    ['Tất cả', 'Tất cả mức giá'],
    ['under', 'Dưới 300.000đ'],
    ['mid', '300.000 – 600.000đ'],
    ['above', 'Trên 600.000đ'],
  ];
  visibleCount = 5;

  get catalogTitle() {
    const m = this.shop.catalogMode;
    if (m === 'new') return 'Hàng mới';
    if (m === 'sale') return 'Ưu đãi';
    if (this.shop.gender === 'Tất cả') return 'Tất cả sản phẩm';
    return 'Thời trang ' + this.shop.gender.toLowerCase();
  }

  get visibleProducts() {
    const total = this.shop.filteredProducts.length;
    if (total <= 5) this.visibleCount = Math.min(this.visibleCount, total || 5);
    if (this.visibleCount > total) this.visibleCount = total || 5;
    return this.shop.filteredProducts.slice(0, this.visibleCount);
  }

  get hasMoreProducts() {
    return this.visibleCount < this.shop.filteredProducts.length;
  }

  loadMore() {
    this.visibleCount = Math.min(this.visibleCount + 5, this.shop.filteredProducts.length);
  }

  resetVisible() {
    this.visibleCount = 5;
  }

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
