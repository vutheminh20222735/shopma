import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ShopService, type ShopBanner } from '../../shop/shop.service';
import { categories } from '../products/constants';
import { ProductCardComponent } from '../products/product-card.component';
import { IconsComponent } from '../../shared/icons.component';

const fallbackBanners: ShopBanner[] = [
  { id: 'fallback-everyday', title: 'EVERYDAY', subtitle: 'Mặc điều bạn thích', description: 'Phong cách tối giản cho mọi ngày.', image: '/images/hero-campaign.png', mobile_image: '/images/hero-campaign.png', href: '/san-pham?mode=all', active: 1, sort_order: 1, button_label: 'Khám phá' },
  { id: 'fallback-women', title: 'Nữ', subtitle: 'Chạm nhẹ, dám nổi bật', description: 'Set đồ nữ phù hợp đi làm và đi chơi.', image: '/images/dress.jpg', mobile_image: '/images/knit.jpg', href: '/san-pham?gender=Nữ', active: 1, sort_order: 2, button_label: 'Xem thời trang nữ' },
  { id: 'fallback-men', title: 'Nam', subtitle: 'Clean & tự tin', description: 'Mẫu áo sơ mi, blazer dễ phối.', image: '/images/shirt.jpg', mobile_image: '/images/tee.jpg', href: '/san-pham?gender=Nam', active: 1, sort_order: 3, button_label: 'Xem thời trang nam' },
  { id: 'fallback-unisex', title: 'Unisex', subtitle: 'Cùng mặc, cùng phong cách', description: 'Tối giản cho mọi phong cách.', image: '/images/jeans.jpg', mobile_image: '/images/pants.jpg', href: '/san-pham?gender=Unisex', active: 1, sort_order: 4, button_label: 'Khám phá Unisex' },
  { id: 'fallback-new', title: 'Mới trong tủ đồ', subtitle: 'Bộ sưu tập mới', description: 'Những món bạn cần cho tháng mới.', image: '/images/blazer.jpg', mobile_image: '/images/tee.jpg', href: '/san-pham?mode=new', active: 1, sort_order: 5, button_label: 'Xem bộ mới' },
];

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ProductCardComponent, IconsComponent],
  template: `<main>
    <section class="hero-carousel" (mouseenter)="pauseAutoPlay()" (mouseleave)="resumeAutoPlay()">
      @if (slides.length) {
        <div class="hero-slide" [class.active]="true" [class.banner-animate]="motionTick % 2 === 1">
          <img
            [src]="currentBanner.image"
            [alt]="currentBanner.title + ' - ' + currentBanner.subtitle"
            class="hero-image"
            fetchpriority="high"
            (error)="onImageError($event)"
          />
          <div class="hero-copy">
            <p class="eyebrow">{{ currentBanner.title }} / {{ currentBanner.subtitle }}</p>
            <h1>{{ currentBanner.subtitle }}<span>.</span></h1>
            <p>{{ currentBanner.description }}</p>
            <a class="button black" [href]="currentBanner.href">{{ currentBanner.button_label || 'Khám phá' }}</a>
          </div>
          <div class="hero-caption">M&A SHOP<span>{{ currentBanner.title }}</span></div>
          <span class="hero-index">{{ currentIndex + 1 }} / {{ slides.length }}</span>
        </div>
      }
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
export class HomePageComponent implements OnInit, OnDestroy {
  shop = inject(ShopService);
  tabCategories = categories;
  currentIndex = 0;
  motionTick = 0;
  timer: number | null = null;
  isPaused = false;
  prefersReducedMotion = false;

  get slides() {
    return this.shop.banners.length ? this.shop.banners : fallbackBanners;
  }

  get currentBanner() {
    return this.slides[this.currentIndex] ?? this.slides[0] ?? fallbackBanners[0];
  }

  ngOnInit() {
    this.prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bindVisibilityListener();
    this.startAutoPlay();
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) this.pauseAutoPlay();
    else if (!this.isPaused && !this.prefersReducedMotion) this.startAutoPlay();
  };

  bindVisibilityListener() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  startAutoPlay() {
    if (this.prefersReducedMotion || this.slides.length <= 1) return;
    this.stopAutoPlay();
    this.timer = window.setInterval(() => {
      if (!this.isPaused) this.nextSlide();
    }, 5000);
  }

  stopAutoPlay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pauseAutoPlay() {
    this.isPaused = true;
    this.stopAutoPlay();
  }

  resumeAutoPlay() {
    this.isPaused = false;
    if (!this.prefersReducedMotion) this.startAutoPlay();
  }

  togglePlayback() {
    if (this.isPaused) this.resumeAutoPlay();
    else this.pauseAutoPlay();
  }

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.motionTick++;
  }

  prevSlide() {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.motionTick++;
  }

  goToSlide(index: number) {
    this.currentIndex = (index + this.slides.length) % this.slides.length;
    this.motionTick++;
  }

  onImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = '/images/hero-campaign.png';
  }

  get homeNew() {
    return this.shop.products
      .filter((p) => this.shop.category === 'Tất cả' || p.category === this.shop.category)
      .slice(0, 8);
  }

  get homeSale() {
    return this.shop.products.filter((p) => p.original_price > p.price).slice(0, 6);
  }
}
