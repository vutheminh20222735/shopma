import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Product } from './types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { normalize } from './utils';
import { ShopService } from '../../shop/shop.service';
import { ProductEditorComponent } from './product-editor.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [FormsModule, ProductEditorComponent, ModalComponent, IconsComponent],
  template: `<div class="admin-toolbar">
      <div class="search-field">
        <app-icon name="search" [size]="18" />
        <input
          placeholder="Tìm sản phẩm…"
          aria-label="Tìm sản phẩm quản lý"
          [(ngModel)]="q"
          name="q"
        />
      </div>
      <button class="button black" (click)="edit = 'new'"><app-icon name="plus" [size]="17" />Thêm sản phẩm</button>
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
                <span [class]="'pill ' + (!p.active ? 'muted' : '')">{{ p.active ? 'Đang bán' : 'Đã ẩn' }}</span>
              </td>
              <td>
                <div class="table-actions">
                  <button class="icon-button" [attr.aria-label]="'Sửa ' + p.name" (click)="edit = p">
                    <app-icon name="pencil" [size]="18" />
                  </button>
                  @if (p.active === 1) {
                    <button class="icon-button" [attr.aria-label]="'Ẩn ' + p.name" (click)="hide = p">
                      <app-icon name="eye" [size]="18" />
                    </button>
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
    @if (edit) {
      <app-product-editor
        [product]="edit === 'new' ? null : edit"
        [busy]="shop.busy"
        (close)="edit = null"
        (save)="onSave($event)"
      />
    }
    @if (hide) {
      <app-modal title="Ẩn sản phẩm?" (close)="hide = null">
        <p>{{ hide.name }} sẽ ngừng hiển thị trong cửa hàng. Đơn hàng cũ vẫn được giữ lại.</p>
        <div class="modal-actions">
          <button class="button outline" (click)="hide = null">Để lại</button>
          <button class="button black" (click)="hideProduct()">Ẩn sản phẩm</button>
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

  onSave(v: any) {
    void this.shop.run(async () => {
      await api('products' + (this.edit === 'new' ? '' : '/' + (this.edit as Product).id), this.edit === 'new' ? 'POST' : 'PATCH', v);
      this.edit = null;
      await this.load();
      await this.shop.reload();
    }, 'Đã lưu sản phẩm.');
  }

  hideProduct() {
    if (!this.hide) return;
    const id = this.hide.id;
    void this.shop.run(async () => {
      await api('products/' + id, 'DELETE', {});
      this.hide = null;
      await this.load();
      await this.shop.reload();
    }, 'Đã ẩn sản phẩm.');
  }
}
