import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Product } from './types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { normalize } from './utils';
import { ShopService } from '../../shop/shop.service';
import { ProductEditorComponent } from './product-editor.component';
import type { PendingImage } from './product-images.component';
import { StaffGrantsComponent } from './staff-grants.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [FormsModule, ProductEditorComponent, StaffGrantsComponent, ModalComponent, IconsComponent],
  template: `@if (!manager) {
      <p class="unavailable-note admin-note">
        <app-icon name="shield-check" [size]="15" />Nhân viên chỉ sửa được sản phẩm khi chủ shop hoặc quản lý đã cấp
        quyền. Nếu chưa có quyền, hệ thống sẽ báo khi lưu.
      </p>
    }
    <div class="admin-toolbar">
      <div class="search-field">
        <app-icon name="search" [size]="18" />
        <input
          placeholder="Tìm sản phẩm…"
          aria-label="Tìm sản phẩm quản lý"
          [(ngModel)]="q"
          name="q"
        />
      </div>
      @if (manager) {
        <button class="button black" (click)="edit = 'new'"><app-icon name="plus" [size]="17" />Thêm sản phẩm</button>
      }
    </div>
    <div class="admin-panel table-scroll">
      <table>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Giá bán</th>
            <th>Size / Màu</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (p of visible; track p.id) {
            <tr>
              <td>
                <div class="table-product">
                  <img [src]="p.image" alt="" />
                  <div>
                    <strong>{{ p.name }}</strong
                    ><small>{{ p.category }} · {{ p.gender }}</small>
                  </div>
                </div>
              </td>
              <td>{{ money(p.price) }}</td>
              <td>{{ p.sizes.length }} size / {{ p.colors.length }} màu</td>
              <td>
                <span [class]="'pill ' + (!p.active ? 'muted' : '')">{{ p.active ? 'Đang bán' : 'Ngừng bán' }}</span>
              </td>
              <td>
                <div class="table-actions">
                  <button class="icon-button" [attr.aria-label]="'Sửa ' + p.name" (click)="edit = p">
                    <app-icon name="pencil" [size]="18" />
                  </button>
                  @if (manager) {
                    @if (p.active === 1) {
                      <button class="text-button danger" [attr.aria-label]="'Ngừng bán ' + p.name" (click)="hide = p">
                        Ngừng bán
                      </button>
                    } @else {
                      <button class="text-button" [attr.aria-label]="'Bán lại ' + p.name" [disabled]="shop.busy" (click)="restore(p)">
                        Bán lại
                      </button>
                    }
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!visible.length) {
        <p class="muted">Không tìm thấy sản phẩm.</p>
      }
    </div>
    @if (manager) {
      <app-staff-grants />
    }
    @if (edit) {
      <app-product-editor
        [product]="edit === 'new' ? null : edit"
        [busy]="shop.busy"
        [manager]="manager"
        (close)="edit = null"
        (save)="onSave($event)"
        (imagesChanged)="refresh()"
      />
    }
    @if (hide) {
      <app-modal title="Ngừng bán sản phẩm?" (close)="hide = null">
        <p>
          {{ hide.name }} sẽ ngừng hiển thị trong cửa hàng và bị gỡ khỏi giỏ hàng. Đơn hàng, đánh giá và hình ảnh cũ vẫn
          được giữ lại; bạn có thể bán lại bất cứ lúc nào.
        </p>
        <div class="modal-actions">
          <button class="button outline" (click)="hide = null">Để lại</button>
          <button class="button black" [disabled]="shop.busy" (click)="hideProduct()">Ngừng bán</button>
        </div>
      </app-modal>
    }`,
})
export class ProductManagementComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  list: Product[] = [];
  q = '';
  edit: Product | 'new' | null = null;
  hide: Product | null = null;

  get manager() {
    return this.shop.isManagement;
  }

  get visible() {
    return this.list.filter((p) => normalize(p.name).includes(normalize(this.q)));
  }

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.list = await api<Product[]>('products?manage=1');
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  async refresh() {
    await this.load();
    await this.shop.reload();
  }

  onSave(v: { body: any; pending: PendingImage[] }) {
    const creating = this.edit === 'new';
    const existingId = creating ? '' : (this.edit as Product).id;
    void this.shop.run(async () => {
      const saved = await api<{ id: string }>(
        'products' + (creating ? '' : '/' + existingId),
        creating ? 'POST' : 'PATCH',
        v.body,
      );
      const productId = saved.id || existingId;
      // Tải ảnh theo đúng thứ tự đã sắp xếp; lỗi ảnh không làm mất sản phẩm vừa lưu.
      let failed = '';
      for (const img of v.pending) {
        try {
          await this.shop.uploadProductImage(productId, img.dataUrl, img.primary);
        } catch (e) {
          failed = (e as Error).message;
          break;
        }
      }
      this.edit = null;
      await this.refresh();
      if (failed) throw new Error('Đã lưu sản phẩm nhưng chưa tải hết ảnh: ' + failed);
    }, 'Đã lưu sản phẩm.');
  }

  hideProduct() {
    if (!this.hide) return;
    const id = this.hide.id;
    void this.shop.run(async () => {
      await this.shop.discontinueProduct(id);
      this.hide = null;
      await this.refresh();
    }, 'Đã ngừng bán sản phẩm.');
  }

  restore(p: Product) {
    void this.shop.run(async () => {
      await this.shop.restoreProduct(p.id);
      await this.refresh();
    }, 'Đã bán lại sản phẩm.');
  }
}
