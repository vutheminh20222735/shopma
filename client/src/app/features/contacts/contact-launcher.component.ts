import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { ContactCardComponent } from './contact-card.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-contact-launcher',
  standalone: true,
  imports: [ContactCardComponent, IconsComponent],
  template: `<div class="floating-contact">
    @if (shop.contactOpen) {
      <div class="contact-popover">
        <strong>Kết nối với M&A</strong>
        <app-contact-card [compact]="true" kind="zalo" [value]="shop.settings.zalo" />
        <app-contact-card [compact]="true" kind="facebook" [value]="shop.settings.facebook" />
        <app-contact-card [compact]="true" kind="phone" [value]="shop.settings.phone" />
      </div>
    }
    <button
      class="contact-launcher"
      [attr.aria-label]="shop.contactOpen ? 'Đóng liên hệ' : 'Liên hệ M&A Shop'"
      (click)="shop.contactOpen = !shop.contactOpen"
    >
      @if (shop.contactOpen) {
        <app-icon name="x" [size]="23" />
      } @else {
        <app-icon name="message-circle" [size]="23" />
      }
    </button>
  </div>`,
})
export class ContactLauncherComponent {
  shop = inject(ShopService);
}
