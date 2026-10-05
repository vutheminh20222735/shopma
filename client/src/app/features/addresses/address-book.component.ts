import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SavedAddress } from './types';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-address-book',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<section class="address-book">
    <div class="section-heading compact">
      <div>
        <h2>Địa chỉ nhận hàng</h2>
        <p class="muted">Lưu một lần để dùng lại mỗi lần đặt hàng. Tối đa 10 địa chỉ.</p>
      </div>
      <button type="button" class="button outline small" (click)="toggleForm()" [disabled]="busy">
        <app-icon [name]="showForm ? 'x' : 'plus'" [size]="16" />{{ showForm ? 'Đóng' : 'Thêm địa chỉ' }}
      </button>
    </div>

    @if (showForm) {
      <form class="address-form" (submit)="save($event)">
        <label>Nhãn <span class="muted">(không bắt buộc)</span>
          <input maxlength="40" placeholder="Nhà, Công ty…" [(ngModel)]="form.label" name="label" />
        </label>
        <label>Họ và tên người nhận
          <input required minlength="2" maxlength="100" [(ngModel)]="form.recipient_name" name="recipient_name" />
        </label>
        <label>Số điện thoại
          <input required type="tel" pattern="\\+?[0-9\\s().-]{8,20}" [(ngModel)]="form.phone" name="phone" />
        </label>
        <label>Địa chỉ
          <textarea required minlength="10" maxlength="500" placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" [(ngModel)]="form.address" name="address"></textarea>
        </label>
        <label class="check-row"><input type="checkbox" [(ngModel)]="form.is_default" name="is_default" />Đặt làm địa chỉ mặc định</label>
        @if (error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }
        <button class="button black small" type="submit" [disabled]="busy">{{ editingId ? 'Cập nhật' : 'Lưu địa chỉ' }}</button>
      </form>
    }

    @if (loading) {
      <p class="muted">Đang tải địa chỉ…</p>
    } @else if (!list.length) {
      <p class="muted">Chưa có địa chỉ đã lưu. Thêm địa chỉ để đặt hàng nhanh hơn.</p>
    } @else {
      <ul class="address-list">
        @for (a of list; track a.id) {
          <li [class.default]="a.is_default">
            <div>
              <strong>{{ a.label || a.recipient_name }}</strong>
              @if (a.is_default) {
                <span class="pill">Mặc định</span>
              }
              <p>{{ a.recipient_name }} · {{ a.phone }}</p>
              <p class="muted">{{ a.address }}</p>
            </div>
            <div class="address-actions">
              @if (!a.is_default) {
                <button type="button" class="text-button" [disabled]="busy" (click)="makeDefault(a)">Đặt mặc định</button>
              }
              <button type="button" class="text-button" [disabled]="busy" (click)="edit(a)">Sửa</button>
              <button type="button" class="text-button danger" [disabled]="busy" (click)="remove(a)">Xóa</button>
            </div>
          </li>
        }
      </ul>
    }
  </section>`,
})
export class AddressBookComponent implements OnInit {
  private shop = inject(ShopService);
  list: SavedAddress[] = [];
  loading = false;
  busy = false;
  showForm = false;
  editingId: string | null = null;
  error = '';
  form = { label: '', recipient_name: '', phone: '', address: '', is_default: false };

  ngOnInit() {
    void this.load();
  }

  private resetForm(partial?: Partial<typeof this.form>) {
    this.form = {
      label: '',
      recipient_name: this.shop.session.user?.name || '',
      phone: '',
      address: '',
      is_default: !this.list.length,
      ...partial,
    };
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.error = '';
    this.editingId = null;
    if (this.showForm) this.resetForm();
  }

  edit(a: SavedAddress) {
    this.editingId = a.id;
    this.showForm = true;
    this.error = '';
    this.resetForm({
      label: a.label,
      recipient_name: a.recipient_name,
      phone: a.phone,
      address: a.address,
      is_default: a.is_default,
    });
  }

  async load() {
    this.loading = true;
    try {
      this.list = await this.shop.listAddresses();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async save(e: Event) {
    e.preventDefault();
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.editingId) {
        await this.shop.updateAddress(this.editingId, this.form);
        this.shop.notify('Đã cập nhật địa chỉ.');
      } else {
        await this.shop.createAddress(this.form);
        this.shop.notify('Đã lưu địa chỉ.');
      }
      this.showForm = false;
      this.editingId = null;
      await this.load();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.busy = false;
    }
  }

  async makeDefault(a: SavedAddress) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.shop.setDefaultAddress(a.id);
      this.shop.notify('Đã đặt địa chỉ mặc định.');
      await this.load();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.busy = false;
    }
  }

  async remove(a: SavedAddress) {
    if (this.busy) return;
    if (!confirm('Xóa địa chỉ này? Đơn hàng cũ không bị ảnh hưởng.')) return;
    this.busy = true;
    try {
      await this.shop.deleteAddress(a.id);
      this.shop.notify('Đã xóa địa chỉ.');
      await this.load();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
