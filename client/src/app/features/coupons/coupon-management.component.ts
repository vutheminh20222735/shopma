import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';

@Component({
  selector: 'app-coupon-management',
  standalone: true,
  imports: [FormsModule],
  template: `<div class="admin-panel">
      <h2>Tạo mã ưu đãi</h2>
      <form
        class="coupon-editor"
        (submit)="
          $event.preventDefault();
          create()
        "
      >
        <label
          >Mã<input
            required
            pattern="[A-Za-z0-9]{3,30}"
            [(ngModel)]="form.code"
            name="code"
            placeholder="MA10"
        /></label>
        <label
          >Giảm (%)<input required type="number" min="1" max="50" [(ngModel)]="form.percent" name="percent"
        /></label>
        <label
          >Đơn tối thiểu (đ)<input required type="number" min="0" [(ngModel)]="form.minimum" name="minimum"
        /></label>
        <button class="button black">Lưu mã</button>
      </form>
    </div>
    <div class="admin-panel table-scroll">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ưu đãi</th>
            <th>Đơn tối thiểu</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (c of coupons; track c.code) {
            <tr>
              <td><strong>{{ c.code }}</strong></td>
              <td>{{ c.percent }}%</td>
              <td>{{ money(c.minimum) }}</td>
              <td>{{ c.active ? 'Đang áp dụng' : 'Đã tắt' }}</td>
              <td>
                @if (c.active) {
                  <button class="text-button danger" (click)="toggleOff(c.code)">Tắt mã</button>
                } @else {
                  <button class="text-button" (click)="toggleOn(c)">Bật lại</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>`,
})
export class CouponManagementComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  coupons: any[] = [];
  form = { code: '', percent: '10', minimum: '300000' };

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.coupons = await api('coupons');
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  create() {
    void this.shop.run(async () => {
      await api('coupons', 'POST', {
        code: this.form.code,
        percent: Number(this.form.percent),
        minimum: Number(this.form.minimum),
      });
      this.form = { ...this.form, code: '' };
      await this.load();
    }, 'Đã lưu mã ưu đãi.');
  }

  toggleOff(code: string) {
    void this.shop.run(async () => {
      await api('coupons/' + code, 'DELETE', {});
      await this.load();
    }, 'Đã tắt mã ưu đãi.');
  }

  toggleOn(c: any) {
    void this.shop.run(async () => {
      await api('coupons', 'POST', c);
      await this.load();
    }, 'Đã bật mã ưu đãi.');
  }
}
