import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<main class="container section">
    <div class="login-card">
      <app-icon name="shield-check" [size]="38" />
      <h2>Đặt lại mật khẩu</h2>
      @if (done) {
        <p class="sample-callout">{{ message }}</p>
        <button class="button black full" (click)="shop.go('/tai-khoan')">Đăng nhập</button>
      } @else if (token) {
        <p>Bạn đang đặt lại mật khẩu từ liên kết trong email. Nhập mật khẩu mới (10–128 ký tự).</p>
        <form class="auth-form" (submit)="$event.preventDefault(); submitWithToken()">
          <label
            >Mật khẩu mới<input
              name="password"
              type="password"
              autocomplete="new-password"
              required
              minlength="10"
              maxlength="128"
              [(ngModel)]="password"
          /></label>
          <label
            >Nhập lại mật khẩu<input
              name="confirm"
              type="password"
              autocomplete="new-password"
              required
              minlength="10"
              maxlength="128"
              [(ngModel)]="confirm"
          /></label>
          <button class="button black full" [disabled]="shop.busy">
            {{ shop.busy ? 'Đang lưu…' : 'Lưu mật khẩu mới' }}
          </button>
        </form>
      } @else {
        <p>Nhập email, <strong>mã 6 số</strong> trong email, rồi đặt mật khẩu mới.</p>
        <form class="auth-form" (submit)="$event.preventDefault(); submitWithCode()">
          <label
            >Email<input name="email" type="email" autocomplete="email" required maxlength="200" [(ngModel)]="email"
          /></label>
          <label
            >Mã xác nhận<input
              name="code"
              inputmode="numeric"
              pattern="[0-9]{6}"
              required
              minlength="6"
              maxlength="6"
              [(ngModel)]="code"
              placeholder="6 chữ số"
          /></label>
          <label
            >Mật khẩu mới<input
              name="password"
              type="password"
              autocomplete="new-password"
              required
              minlength="10"
              maxlength="128"
              [(ngModel)]="password"
          /></label>
          <label
            >Nhập lại mật khẩu<input
              name="confirm"
              type="password"
              autocomplete="new-password"
              required
              minlength="10"
              maxlength="128"
              [(ngModel)]="confirm"
          /></label>
          <button class="button black full" [disabled]="shop.busy">
            {{ shop.busy ? 'Đang lưu…' : 'Lưu mật khẩu mới' }}
          </button>
        </form>
        <button class="text-button auth-toggle" (click)="shop.go('/quen-mat-khau')">Gửi lại mã</button>
      }
    </div>
  </main>`,
})
export class ResetPasswordPageComponent implements OnInit {
  shop = inject(ShopService);
  private route = inject(ActivatedRoute);
  token = '';
  email = '';
  code = '';
  password = '';
  confirm = '';
  done = false;
  message = '';

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  private ensureMatch() {
    if (this.password !== this.confirm) {
      this.shop.notify('Hai mật khẩu không khớp.', true);
      return false;
    }
    return true;
  }

  submitWithToken() {
    if (!this.ensureMatch()) return;
    void this.shop.run(async () => {
      const result = await api<{ message: string }>('auth/reset-password', 'POST', {
        token: this.token,
        password: this.password,
      });
      this.finish(result.message);
    });
  }

  submitWithCode() {
    if (!this.ensureMatch()) return;
    void this.shop.run(async () => {
      const result = await api<{ message: string }>('auth/reset-password', 'POST', {
        email: this.email,
        code: this.code,
        password: this.password,
      });
      this.finish(result.message);
    });
  }

  private finish(message: string) {
    this.message = message;
    this.done = true;
    this.password = '';
    this.confirm = '';
    this.code = '';
  }
}
