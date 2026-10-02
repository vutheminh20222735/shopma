import { Component, OnChanges, SimpleChanges, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Settings } from './types';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';

@Component({
  selector: 'app-shop-settings',
  standalone: true,
  imports: [FormsModule],
  template: `<div class="admin-panel settings-panel">
    <h2>Thông tin liên hệ</h2>
    <p class="muted">Thông tin được hiển thị ở chân trang, trang liên hệ và nút chat nổi.</p>
    <form
      class="editor-form"
      (submit)="
        $event.preventDefault();
        save()
      "
    >
      <label
        >Số điện thoại<input
          type="tel"
          placeholder="Nhập số điện thoại của shop"
          [(ngModel)]="form.phone"
          name="phone"
      /></label>
      <label
        >Đường dẫn Zalo<input
          type="url"
          placeholder="https://zalo.me/so-dien-thoai"
          [(ngModel)]="form.zalo"
          name="zalo"
      /></label>
      <label
        >Đường dẫn Facebook<input
          type="url"
          placeholder="https://www.facebook.com/ten-trang-shop"
          [(ngModel)]="form.facebook"
          name="facebook"
      /></label>
      <label
        >Địa chỉ cửa hàng<textarea
          placeholder="Nhập địa chỉ cửa hàng"
          [(ngModel)]="form.address"
          name="address"
        ></textarea
      ></label>
      <label>Giờ hỗ trợ<input [(ngModel)]="form.hours" name="hours" /></label>
      <button class="button black" [disabled]="shop.busy">{{ shop.busy ? 'Đang lưu…' : 'Lưu thông tin shop' }}</button>
    </form>
  </div>`,
})
export class ShopSettingsComponent implements OnChanges {
  @Input({ required: true }) settings!: Settings;
  shop = inject(ShopService);
  form: Settings = { phone: '', zalo: '', facebook: '', address: '', hours: '' };

  ngOnChanges(_changes: SimpleChanges) {
    this.form = { ...this.settings };
  }

  save() {
    void this.shop.run(async () => {
      await api('settings', 'PATCH', this.form);
      await this.shop.reload();
    }, 'Đã cập nhật thông tin shop.');
  }
}
