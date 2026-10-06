import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';

type BannerDraft = {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  mobile_image: string;
  href: string;
  button_label: string;
  sort_order: number;
  active: number;
};

@Component({
  selector: 'app-banner-management',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="banner-manager-grid">
      <div class="banner-manager-list">
        <h3>Banner đang bật</h3>
        @if (banners.length) {
          <ul class="banner-list">
            @for (banner of banners; track banner.id) {
              <li>
                <img [src]="banner.image || '/images/hero-campaign.png'" [alt]="banner.title" (error)="onImageError($event)" />
                <div>
                  <strong>{{ banner.title }}</strong>
                  <small>{{ banner.subtitle || 'Không có phụ đề' }}</small>
                  <small>{{ banner.href }}</small>
                </div>
                <div class="banner-actions">
                  <button class="text-button" type="button" (click)="edit(banner)">Sửa</button>
                  <button class="text-button" type="button" (click)="toggle(banner)">{{ banner.active === 0 ? 'Bật' : 'Tắt' }}</button>
                  <button class="text-button danger" type="button" (click)="remove(banner.id)">Xóa</button>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="muted">Chưa có banner nào. Thêm banner đầu tiên để hiển thị trên trang chủ.</p>
        }
      </div>

      <div class="banner-manager-form">
        <h3>{{ form.id ? 'Sửa banner' : 'Thêm banner mới' }}</h3>
        <form (submit)="$event.preventDefault(); save()">
          <div class="form-grid">
            <label>
              Tiêu đề
              <input [(ngModel)]="form.title" name="title" placeholder="EVERYDAY" />
            </label>
            <label>
              Phụ đề
              <input [(ngModel)]="form.subtitle" name="subtitle" placeholder="Mặc điều bạn thích" />
            </label>
            <label>
              Nội dung nút
              <input [(ngModel)]="form.button_label" name="button_label" placeholder="Khám phá" />
            </label>
            <label>
              Thứ tự hiển thị
              <input type="number" [(ngModel)]="form.sort_order" name="sort_order" />
            </label>
            <label>
              Đường dẫn đích
              <input [(ngModel)]="form.href" name="href" placeholder="/san-pham?gender=Nữ" />
            </label>
            <label>
              Trạng thái
              <select [(ngModel)]="form.active" name="active">
                <option [ngValue]="1">Bật hiển thị</option>
                <option [ngValue]="0">Tắt</option>
              </select>
            </label>
            <label style="grid-column:1 / -1;">
              Mô tả ngắn
              <textarea [(ngModel)]="form.description" name="description" placeholder="Mô tả banner..."></textarea>
            </label>
            <label>
              Ảnh desktop
              <input [(ngModel)]="form.image" name="image" placeholder="/images/... hoặc data URL" />
            </label>
            <label>
              Ảnh mobile
              <input [(ngModel)]="form.mobile_image" name="mobile_image" placeholder="/images/... hoặc data URL" />
            </label>
          </div>

          <div class="banner-preview">
            <div class="banner-preview-box">
              <img [src]="form.image || '/images/hero-campaign.png'" alt="Desktop preview" (error)="onImageError($event)" />
              <strong>Desktop</strong>
              <small>{{ form.title || 'Tiêu đề' }}</small>
            </div>
            <div class="banner-preview-box">
              <img [src]="form.mobile_image || form.image || '/images/hero-campaign.png'" alt="Mobile preview" (error)="onImageError($event)" />
              <strong>Mobile</strong>
              <small>{{ form.subtitle || 'Phụ đề' }}</small>
            </div>
          </div>

          <div class="admin-toolbar" style="margin-top:16px;">
            <button class="button black" type="submit">{{ form.id ? 'Lưu thay đổi' : 'Thêm banner' }}</button>
            <button class="button outline" type="button" (click)="resetForm()">Làm mới</button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class BannerManagementComponent implements OnInit {
  shop = inject(ShopService);
  banners: any[] = [];
  form: BannerDraft = {
    title: 'EVERYDAY',
    subtitle: 'Mặc điều bạn thích',
    description: '',
    image: '/images/hero-campaign.png',
    mobile_image: '/images/hero-campaign.png',
    href: '/san-pham?mode=all',
    button_label: 'Khám phá',
    sort_order: 0,
    active: 1,
  };

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.banners = await api<any[]>('banners?all=1');
      if (!this.banners.length) this.banners = [];
    } catch (error) {
      this.shop.notify((error as Error).message, true);
    }
  }

  resetForm() {
    this.form = {
      title: 'EVERYDAY',
      subtitle: 'Mặc điều bạn thích',
      description: '',
      image: '/images/hero-campaign.png',
      mobile_image: '/images/hero-campaign.png',
      href: '/san-pham?mode=all',
      button_label: 'Khám phá',
      sort_order: 0,
      active: 1,
    };
  }

  edit(banner: any) {
    this.form = {
      id: banner.id,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      description: banner.description || '',
      image: banner.image || '/images/hero-campaign.png',
      mobile_image: banner.mobile_image || banner.image || '/images/hero-campaign.png',
      href: banner.href || '/san-pham',
      button_label: banner.button_label || 'Khám phá',
      sort_order: Number(banner.sort_order || 0),
      active: Number(banner.active ?? 1),
    };
  }

  async save() {
    const payload = {
      title: this.form.title,
      subtitle: this.form.subtitle,
      description: this.form.description,
      image: this.form.image,
      mobile_image: this.form.mobile_image,
      href: this.form.href,
      button_label: this.form.button_label,
      sort_order: Number(this.form.sort_order || 0),
      active: Number(this.form.active ?? 1),
    };
    try {
      if (this.form.id) await api('banners/' + encodeURIComponent(this.form.id), 'PATCH', payload);
      else await api('banners', 'POST', payload);
      this.resetForm();
      await this.load();
      this.shop.notify('Banner đã được lưu.');
    } catch (error) {
      this.shop.notify((error as Error).message, true);
    }
  }

  async toggle(banner: any) {
    try {
      await api('banners/' + encodeURIComponent(banner.id), 'PATCH', { active: banner.active === 0 ? 1 : 0 });
      await this.load();
    } catch (error) {
      this.shop.notify((error as Error).message, true);
    }
  }

  async remove(id: string) {
    try {
      await api('banners/' + encodeURIComponent(id), 'DELETE', {});
      await this.load();
      if (this.form.id === id) this.resetForm();
    } catch (error) {
      this.shop.notify((error as Error).message, true);
    }
  }

  onImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = '/images/hero-campaign.png';
  }
}
