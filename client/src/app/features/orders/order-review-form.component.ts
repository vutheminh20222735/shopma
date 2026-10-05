import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-order-review-form',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<form class="review-form order-review-form" (submit)="submit($event)">
    <p class="muted">Đánh giá <strong>{{ productName }}</strong></p>
    <div class="star-picker" role="radiogroup" aria-label="Chấm điểm">
      @for (i of stars; track i) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="rating === i"
          [attr.aria-label]="i + ' sao'"
          [class.on]="i <= rating"
          (click)="rating = i"
        >
          <app-icon name="star" [size]="28" [strokeWidth]="1.5" [fill]="i <= rating ? 'currentColor' : 'none'" />
        </button>
      }
    </div>
    <label
      >Nhận xét (từ 10 ký tự)
      <textarea
        required
        minlength="10"
        maxlength="1000"
        [(ngModel)]="content"
        name="content"
        placeholder="Chất liệu, form dáng, độ vừa vặn…"
      ></textarea>
    </label>
    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    <div class="review-form-actions">
      <button class="button black" type="submit" [disabled]="busy">{{ busy ? 'Đang gửi…' : 'Gửi đánh giá' }}</button>
      <button class="button outline" type="button" (click)="cancel.emit()" [disabled]="busy">Hủy</button>
    </div>
  </form>`,
})
export class OrderReviewFormComponent {
  private shop = inject(ShopService);
  @Input({ required: true }) productId!: string;
  @Input() productName = 'sản phẩm';
  @Output() cancel = new EventEmitter<void>();
  @Output() done = new EventEmitter<void>();

  stars = [1, 2, 3, 4, 5];
  rating = 0;
  content = '';
  busy = false;
  error = '';

  async submit(e: Event) {
    e.preventDefault();
    this.error = '';
    if (this.rating < 1) {
      this.error = 'Vui lòng chọn số sao.';
      return;
    }
    this.busy = true;
    try {
      await this.shop.createReview(this.productId, this.rating, this.content.trim());
      this.shop.notify('Cảm ơn bạn đã đánh giá sản phẩm.');
      this.done.emit();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
