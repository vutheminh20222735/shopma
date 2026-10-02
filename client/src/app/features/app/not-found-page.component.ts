import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { EmptyComponent } from '../../shared/ui/empty.component';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [EmptyComponent],
  template: `<app-empty title="Không tìm thấy trang">
    <button class="button black" (click)="shop.go('/')">Về trang chủ</button>
  </app-empty>`,
})
export class NotFoundPageComponent {
  shop = inject(ShopService);
}
