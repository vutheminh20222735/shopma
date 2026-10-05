import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import type { ProductImage } from './types';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

export type PendingImage = { key: string; name: string; dataUrl: string; primary: boolean };

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Quản lý ảnh sản phẩm.
 * - Sản phẩm đã có: xem ảnh hiện có, sắp thứ tự, đặt ảnh chính, xóa; chọn thêm nhiều ảnh (xem trước base64) rồi tải lên.
 * - Sản phẩm mới: chọn ảnh, sắp thứ tự, chọn ảnh chính; ảnh được tải lên sau khi lưu sản phẩm (qua sự kiện pendingChange).
 */
@Component({
  selector: 'app-product-images',
  standalone: true,
  imports: [IconsComponent],
  template: `<fieldset class="image-manager">
    <legend>Ảnh sản phẩm ({{ images.length + pending.length }}/{{ max }})</legend>

    @if (productId) {
      @if (loading) {
        <p class="muted">Đang tải ảnh…</p>
      }
      <ul class="image-grid">
        @for (img of images; track img.id || img.path; let i = $index; let first = $first; let last = $last) {
          <li [class.primary]="!!img.is_primary">
            <img [src]="img.path" alt="Ảnh sản phẩm" />
            @if (img.is_primary) {
              <span class="image-badge">Ảnh chính</span>
            }
            <div class="image-actions">
              @if (img.id && images.length > 1) {
                <button type="button" class="icon-button" aria-label="Đưa lên trước" [disabled]="busy || first" (click)="moveSaved(i, -1)">
                  <app-icon name="arrow-up" [size]="16" />
                </button>
                <button type="button" class="icon-button" aria-label="Đưa xuống sau" [disabled]="busy || last" (click)="moveSaved(i, 1)">
                  <app-icon name="arrow-down" [size]="16" />
                </button>
              }
              @if (!img.is_primary && img.id) {
                <button type="button" class="text-button" [disabled]="busy" (click)="makePrimary(img)">Đặt làm ảnh chính</button>
              }
              @if (img.id && images.length > 1) {
                <button type="button" class="icon-button" aria-label="Xóa ảnh" [disabled]="busy" (click)="remove(img)">
                  <app-icon name="trash-2" [size]="16" />
                </button>
              }
            </div>
          </li>
        }
      </ul>
    }

    @if (pending.length) {
      <p class="muted">{{ productId ? 'Ảnh chờ tải lên' : 'Ảnh sẽ được tải lên sau khi lưu sản phẩm' }}</p>
      <ul class="image-grid">
        @for (img of pending; track img.key; let i = $index; let first = $first; let last = $last) {
          <li [class.primary]="img.primary">
            <img [src]="img.dataUrl" [alt]="'Xem trước ' + img.name" />
            @if (img.primary) {
              <span class="image-badge">Ảnh chính</span>
            }
            <div class="image-actions">
              <button type="button" class="icon-button" aria-label="Đưa lên trước" [disabled]="first" (click)="move(i, -1)">
                <app-icon name="arrow-up" [size]="16" />
              </button>
              <button type="button" class="icon-button" aria-label="Đưa xuống sau" [disabled]="last" (click)="move(i, 1)">
                <app-icon name="arrow-down" [size]="16" />
              </button>
              @if (!img.primary) {
                <button type="button" class="text-button" (click)="setPendingPrimary(img)">Ảnh chính</button>
              }
              <button type="button" class="icon-button" aria-label="Bỏ ảnh này" (click)="drop(i)">
                <app-icon name="x" [size]="16" />
              </button>
            </div>
          </li>
        }
      </ul>
    }

    <div class="image-toolbar">
      <label class="button outline small file-button" [class.disabled]="full">
        <app-icon name="image" [size]="16" />Chọn ảnh
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          [disabled]="full"
          (change)="pick($event)"
          aria-label="Chọn ảnh sản phẩm"
        />
      </label>
      @if (productId && pending.length) {
        <button type="button" class="button black small" [disabled]="busy" (click)="uploadAll()">
          <app-icon name="upload" [size]="16" />{{ busy ? 'Đang tải lên…' : 'Tải lên ' + pending.length + ' ảnh' }}
        </button>
      }
      <span class="muted">JPEG, PNG hoặc WebP · tối đa 5MB mỗi ảnh · tối đa {{ max }} ảnh</span>
    </div>
    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
  </fieldset>`,
})
export class ProductImagesComponent implements OnChanges {
  private shop = inject(ShopService);
  /** null = sản phẩm mới (chưa có id). */
  @Input() productId: string | null = null;
  @Input() pending: PendingImage[] = [];
  @Output() pendingChange = new EventEmitter<PendingImage[]>();
  @Output() imagesChanged = new EventEmitter<void>();

  max = MAX_IMAGES;
  images: ProductImage[] = [];
  loading = false;
  busy = false;
  error = '';

  get full() {
    return this.images.length + this.pending.length >= MAX_IMAGES;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['productId']) void this.loadImages();
  }

  async loadImages() {
    this.images = [];
    if (!this.productId) return;
    this.loading = true;
    try {
      const p = await this.shop.getProduct(this.productId, true);
      this.images = p.images?.length ? p.images : [];
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private emit(list: PendingImage[]) {
    this.pending = list;
    this.pendingChange.emit(list);
  }

  async pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.error = '';
    const list = [...this.pending];
    const errors: string[] = [];
    for (const file of files) {
      if (this.images.length + list.length >= MAX_IMAGES) {
        errors.push(`Mỗi sản phẩm tối đa ${MAX_IMAGES} ảnh.`);
        break;
      }
      if (!ACCEPT.includes(file.type)) {
        errors.push(`"${file.name}" không phải ảnh JPEG, PNG hoặc WebP.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`"${file.name}" vượt quá 5MB.`);
        continue;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        const hasPrimary = list.some((x) => x.primary) || this.images.some((x) => x.is_primary);
        list.push({ key: crypto.randomUUID(), name: file.name, dataUrl, primary: !hasPrimary && !this.productId });
      } catch {
        errors.push(`Không đọc được "${file.name}".`);
      }
    }
    this.emit(list);
    if (errors.length) this.error = errors.join(' ');
  }

  move(index: number, delta: number) {
    const list = [...this.pending];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.emit(list);
  }

  drop(index: number) {
    const list = this.pending.filter((_, i) => i !== index);
    // Giữ một ảnh chính trong hàng chờ khi sản phẩm mới.
    if (!this.productId && list.length && !list.some((x) => x.primary)) list[0] = { ...list[0], primary: true };
    this.emit(list);
  }

  setPendingPrimary(img: PendingImage) {
    this.emit(this.pending.map((x) => ({ ...x, primary: x.key === img.key })));
  }

  async moveSaved(index: number, delta: number) {
    if (!this.productId) return;
    const target = index + delta;
    if (target < 0 || target >= this.images.length) return;
    const next = [...this.images];
    [next[index], next[target]] = [next[target], next[index]];
    const ids = next.map((x) => x.id).filter(Boolean);
    if (ids.length !== next.length) return;
    this.images = next;
    await this.guard(async () => {
      await this.shop.reorderProductImages(this.productId!, ids);
      this.shop.notify('Đã cập nhật thứ tự ảnh.');
    });
  }

  async makePrimary(img: ProductImage) {
    if (!this.productId) return;
    await this.guard(async () => {
      await this.shop.setPrimaryImage(this.productId!, img.id);
      this.shop.notify('Đã đặt ảnh chính.');
    });
  }

  async remove(img: ProductImage) {
    await this.guard(async () => {
      await this.shop.deleteProductImage(img.id);
      this.shop.notify('Đã xóa ảnh.');
    });
  }

  async uploadAll() {
    const productId = this.productId;
    if (!productId) return;
    await this.guard(async () => {
      const queue = [...this.pending];
      for (const img of queue) {
        try {
          await this.shop.uploadProductImage(productId, img.dataUrl, img.primary);
        } catch (e) {
          // Giữ lại các ảnh chưa tải để thử lại.
          this.emit(this.pending.filter((x) => queue.indexOf(x) >= queue.indexOf(img)));
          throw e;
        }
      }
      this.emit([]);
      this.shop.notify('Đã tải ảnh lên.');
    });
  }

  private async guard(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await fn();
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      await this.loadImages();
      this.imagesChanged.emit();
    }
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
