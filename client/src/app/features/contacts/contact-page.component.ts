import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { ContactCardComponent } from './contact-card.component';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [ContactCardComponent],
  template: `<main class="container section contact-page">
    <p class="eyebrow">LET’S TALK</p>
    <h1>M&A luôn sẵn lòng<br />nghe bạn.</h1>
    <p>
      Cần chọn size, hỏi về sản phẩm hay kiểm tra đơn hàng?<br />Liên hệ với shop qua kênh thuận tiện cho
      bạn.
    </p>
    <div class="contact-grid">
      <app-contact-card kind="zalo" [value]="shop.settings.zalo" />
      <app-contact-card kind="facebook" [value]="shop.settings.facebook" />
      <app-contact-card kind="phone" [value]="shop.settings.phone" />
    </div>
    <div class="contact-meta">
      <div>
        <h3>Ghé M&A Shop</h3>
        <p>{{ shop.settings.address || 'Địa chỉ cửa hàng đang được cập nhật.' }}</p>
      </div>
      <div>
        <h3>Giờ hỗ trợ</h3>
        <p>{{ shop.settings.hours }}</p>
      </div>
    </div>
    @if (shop.session.user?.role === 'admin') {
      <button class="button outline" (click)="shop.go('/quan-tri/cai-dat')">Cập nhật thông tin liên hệ</button>
    }
  </main>`,
})
export class ContactPageComponent {
  shop = inject(ShopService);
}
