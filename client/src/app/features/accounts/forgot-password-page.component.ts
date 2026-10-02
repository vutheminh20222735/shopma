import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<main class="container section">
    <div class="login-card">
      <app-icon name="mail" [size]="38" />
      <h2>Quên mật khẩu</h2>
      <p>
        Nhập email đã đăng ký. Chúng tôi sẽ gửi <strong>mã 6 số</strong> và liên kết đặt lại mật khẩu vào email
        (hiệu lực 15 phút). Mã/link không hiện trên trang này để tránh bị lộ.
      </p>
      @if (done) {
        <p class="sample-callout">{{ message }}</p>
        <button class="button black full" (click)="shop.go('/dat-lai-mat-khau')">Tôi đã nhận mã / mở trang đặt lại</button>
        <button class="text-button auth-toggle" (click)="shop.go('/tai-khoan')">Về đăng nhập</button>
      } @else {
        <form
          class="auth-form"
          (submit)="
            $event.preventDefault();
            submit()
          "
        >
          <label
            >Email<input
              name="email"
              type="email"
              autocomplete="email"
              required
              maxlength="200"
              [(ngModel)]="email"
          /></label>
          <button class="button black full" [disabled]="shop.busy">
            {{ shop.busy ? 'Đang gửi…' : 'Gửi mã về email' }}
          </button>
        </form>
        <button class="text-button auth-toggle" [disabled]="shop.busy" (click)="shop.go('/tai-khoan')">
          Quay lại đăng nhập
        </button>
      }
    </div>
  </main>`,
})
export class ForgotPasswordPageComponent {
  shop = inject(ShopService);
  email = '';
  done = false;
  message = '';

  submit() {
    void this.shop.run(async () => {
      const result = await api<{ message: string }>('auth/forgot-password', 'POST', {
        email: this.email,
      });
      this.message = result.message;
      this.done = true;
    });
  }
}
