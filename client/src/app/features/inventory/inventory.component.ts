import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Member } from '../accounts/types';
import { api } from '../../shared/api';
import { normalize } from '../products/utils';
import { ShopService } from '../../shop/shop.service';
import { ModalComponent } from '../../shared/ui/modal.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, ModalComponent, IconsComponent],
  template: `<div class="admin-toolbar">
      <div class="search-field">
        <app-icon name="search" [size]="18" />
        <input aria-label="Tìm tồn kho" placeholder="Tên, size hoặc màu…" [(ngModel)]="q" name="q" />
      </div>
      <label class="check-label"
        ><input type="checkbox" [(ngModel)]="low" name="low" />Chỉ xem sắp hết (≤ 3)</label
      >
    </div>
    <p class="muted">
      {{ visible.length }} biến thể ·
      {{
        manager
          ? 'Số lượng được trừ khi đặt đơn và hoàn lại khi hủy.'
          : 'Bạn có quyền xem tồn kho. Quản lý phụ trách cập nhật số lượng.'
      }}
    </p>
    <div class="admin-panel table-scroll">
      <table>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Size</th>
            <th>Màu</th>
            <th>Tồn kho</th>
            @if (manager) {
              <th>Thao tác</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of visible; track r.id) {
            <tr>
              <td>
                <div class="table-product">
                  <img [src]="r.image" alt="" /><strong>{{ r.name }}</strong>
                </div>
              </td>
              <td>{{ r.size }}</td>
              <td>{{ r.color }}</td>
              <td>
                <span [class]="r.stock <= 3 ? 'low-stock' : 'stock-number'">{{ r.stock }}</span>
              </td>
              @if (manager) {
                <td>
                  <button class="text-button" (click)="openEdit(r)">Cập nhật</button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (!visible.length) {
        <p class="muted">Không có biến thể phù hợp.</p>
      }
    </div>
    @if (edit) {
      <app-modal title="Cập nhật tồn kho" (close)="edit = null">
        <p>{{ edit.name }} · {{ edit.color }} / {{ edit.size }}</p>
        <form
          class="editor-form"
          (submit)="
            $event.preventDefault();
            saveStock()
          "
        >
          <label
            >Số lượng hiện có<input
              required
              type="number"
              min="0"
              max="100000"
              [(ngModel)]="stock"
              name="stock"
          /></label>
          <button class="button black">Lưu tồn kho</button>
        </form>
      </app-modal>
    }`,
})
export class InventoryComponent implements OnInit {
  @Input({ required: true }) user!: Member;
  shop = inject(ShopService);

  rows: any[] = [];
  q = '';
  low = false;
  edit: any = null;
  stock = '';

  get manager() {
    return ['admin', 'manager'].includes(this.user.role);
  }

  get visible() {
    return this.rows.filter(
      (r) =>
        r.active &&
        normalize(r.name + ' ' + r.size + ' ' + r.color).includes(normalize(this.q)) &&
        (!this.low || r.stock <= 3),
    );
  }

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.rows = await api('inventory');
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  openEdit(r: any) {
    this.edit = r;
    this.stock = String(r.stock);
  }

  saveStock() {
    if (!this.edit) return;
    const id = this.edit.id;
    void this.shop.run(async () => {
      await api('inventory/' + encodeURIComponent(id), 'PATCH', { stock: Number(this.stock) });
      this.edit = null;
      await this.load();
    }, 'Đã cập nhật tồn kho.');
  }
}
