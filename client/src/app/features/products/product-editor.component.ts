import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Product } from './types';
import { categories } from './constants';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ProductImagesComponent, type PendingImage } from './product-images.component';

const SEED_IMAGES = [
  { name: 'Áo thun Essential Cotton', image: '/images/tee.jpg' },
  { name: 'Sơ mi Oxford Relaxed', image: '/images/shirt.jpg' },
  { name: 'Quần jeans Straight Fit', image: '/images/jeans.jpg' },
  { name: 'Áo len Soft Knit', image: '/images/knit.jpg' },
  { name: 'Blazer City Tailored', image: '/images/blazer.jpg' },
  { name: 'Quần suông Everyday', image: '/images/pants.jpg' },
  { name: 'Đầm Weekend Midi', image: '/images/dress.jpg' },
  { name: 'Túi Everyday Shoulder', image: '/images/bag.jpg' },
];

@Component({
  selector: 'app-product-editor',
  standalone: true,
  imports: [FormsModule, ModalComponent, ProductImagesComponent],
  template: `<app-modal [title]="product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'" [wide]="true" (close)="close.emit()">
    <form class="editor-form" (submit)="submit($event)">
      <label
        >Tên sản phẩm<input required maxlength="120" [(ngModel)]="form.name" name="name"
      /></label>
      <div class="form-grid">
        <label
          >Danh mục
          <select [(ngModel)]="form.category" name="category">
            @for (c of categoryOptions; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </label>
        <label
          >Dành cho
          <select [(ngModel)]="form.gender" name="gender">
            @for (g of genders; track g) {
              <option [value]="g">{{ g }}</option>
            }
          </select>
        </label>
        <label
          >Giá bán (đ)<input required type="number" min="1000" max="100000000" [(ngModel)]="form.price" name="price"
        /></label>
        <label
          >Giá gốc (0 nếu không giảm)<input
            type="number"
            min="0"
            max="100000000"
            [(ngModel)]="form.original_price"
            name="original_price"
        /></label>
      </div>
      @if (!product) {
        <label
          >Ảnh mặc định ban đầu
          <select [(ngModel)]="form.image" name="image">
            @for (s of seedImages; track s.image) {
              <option [value]="s.image">{{ s.name }}</option>
            }
          </select>
          <small class="muted">Ảnh tải lên bên dưới sẽ được dùng thay khi chọn làm ảnh chính.</small>
        </label>
      }
      <app-product-images
        [productId]="product?.id ?? null"
        [pending]="pending"
        (pendingChange)="pending = $event"
        (imagesChanged)="imagesChanged.emit()"
      />
      <div class="form-grid">
        <label
          >Size, cách nhau bằng dấu phẩy<input required [(ngModel)]="form.sizes" name="sizes"
        /></label>
        <label
          >Màu, cách nhau bằng dấu phẩy<input required [(ngModel)]="form.colors" name="colors"
        /></label>
      </div>
      <label>Chất liệu<input [(ngModel)]="form.material" name="material" /></label>
      <label>Mô tả<textarea [(ngModel)]="form.description" name="description" maxlength="2000"></textarea></label>
      @if (!product) {
        <label
          >Tồn kho mỗi biến thể<input type="number" min="0" max="100000" [(ngModel)]="form.stock" name="stock"
        /></label>
      }
      <div class="form-grid">
        <label class="check-label"
          ><input type="checkbox" [checked]="!!form.is_new" (change)="form.is_new = $any($event.target).checked ? 1 : 0" />Đánh
          dấu hàng mới</label
        >
        @if (manager) {
          <label class="check-label"
            ><input type="checkbox" [checked]="!!form.active" (change)="form.active = $any($event.target).checked ? 1 : 0" />Hiển
            thị trong cửa hàng</label
          >
        }
      </div>
      <button class="button black full" [disabled]="busy">{{ busy ? 'Đang lưu…' : 'Lưu sản phẩm' }}</button>
    </form>
  </app-modal>`,
})
export class ProductEditorComponent implements OnInit, OnChanges {
  @Input() product: Product | null = null;
  @Input() busy = false;
  @Input() manager = true;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ body: any; pending: PendingImage[] }>();
  @Output() imagesChanged = new EventEmitter<void>();

  pending: PendingImage[] = [];

  seedImages = SEED_IMAGES;
  categoryOptions = categories.slice(1);
  genders = ['Nam', 'Nữ', 'Unisex'];

  form = {
    name: '',
    category: 'Áo thun',
    gender: 'Unisex',
    price: '249000',
    original_price: '0',
    image: '/images/tee.jpg',
    material: '',
    description: '',
    sizes: 'S, M, L, XL',
    colors: 'Trắng, Đen',
    is_new: 1,
    active: 1,
    stock: '10',
  };

  ngOnInit() {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Chỉ đặt lại biểu mẫu khi đổi sản phẩm (không xóa dữ liệu đang nhập khi cờ busy thay đổi).
    if (changes['product'] && !changes['product'].firstChange) this.resetForm();
  }

  private resetForm() {
    this.pending = [];
    this.form = {
      name: this.product?.name || '',
      category: this.product?.category || 'Áo thun',
      gender: this.product?.gender || 'Unisex',
      price: String(this.product?.price || 249000),
      original_price: String(this.product?.original_price || 0),
      image: this.product?.image || '/images/tee.jpg',
      material: this.product?.material || '',
      description: this.product?.description || '',
      sizes: this.product?.sizes.join(', ') || 'S, M, L, XL',
      colors: this.product?.colors.join(', ') || 'Trắng, Đen',
      is_new: this.product?.is_new ?? 1,
      active: this.product?.active ?? 1,
      stock: '10',
    };
  }

  submit(e: Event) {
    e.preventDefault();
    this.save.emit({
      body: {
        ...this.form,
        price: Number(this.form.price),
        original_price: Number(this.form.original_price),
        sizes: this.form.sizes.split(',').map((s) => s.trim()),
        colors: this.form.colors.split(',').map((s) => s.trim()),
        stock: Number(this.form.stock),
      },
      pending: this.pending,
    });
  }
}
