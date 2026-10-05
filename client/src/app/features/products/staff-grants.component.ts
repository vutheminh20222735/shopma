import { Component, OnInit, inject } from '@angular/core';
import type { StaffGrant } from './types';
import { ShopService } from '../../shop/shop.service';

@Component({
  selector: 'app-staff-grants',
  standalone: true,
  template: `<div class="admin-panel">
    <h2>Quyền sửa sản phẩm của nhân viên</h2>
    <p class="muted">
      Mặc định nhân viên chỉ xem và xử lý đơn. Cấp quyền để nhân viên chỉnh sửa thông tin và ảnh sản phẩm có sẵn; nhân
      viên không thể thêm mới, ngừng bán hoặc cấp quyền.
    </p>
    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    @if (grants === null) {
      <p class="muted">Đang tải…</p>
    } @else if (!grants.length) {
      <p class="muted">Chưa có tài khoản nhân viên nào. Chủ shop tạo tài khoản ở mục Phân quyền.</p>
    } @else {
      <ul class="grant-list">
        @for (g of grants; track g.id) {
          <li>
            <div>
              <strong>{{ g.name }}</strong>
              <small class="muted block">{{ g.email }}</small>
            </div>
            <label class="check-label">
              <input
                type="checkbox"
                [checked]="!!g.can_edit"
                [disabled]="shop.busy"
                [attr.aria-label]="'Cho phép ' + g.name + ' sửa sản phẩm'"
                (change)="toggle(g, $any($event.target).checked)"
              />
              {{ g.can_edit ? 'Được sửa sản phẩm' : 'Chỉ xem' }}
            </label>
          </li>
        }
      </ul>
    }
  </div>`,
})
export class StaffGrantsComponent implements OnInit {
  shop = inject(ShopService);
  grants: StaffGrant[] | null = null;
  error = '';

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.grants = await this.shop.getProductGrants();
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
      this.grants = [];
    }
  }

  toggle(g: StaffGrant, value: boolean) {
    void this.shop
      .run(async () => {
        await this.shop.setProductGrant(g.id, value);
        g.can_edit = value ? 1 : 0;
      }, value ? 'Đã cấp quyền sửa sản phẩm.' : 'Đã thu hồi quyền sửa sản phẩm.')
      .then(() => this.load());
  }
}
