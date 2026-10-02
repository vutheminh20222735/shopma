import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<div class="login-card">
    <app-icon name="user-round" [size]="38" />
    <h2>{{ mode === 'login' ? 'Đăng nhập M&A Shop' : 'Tạo tài khoản M&A Shop' }}</h2>
    <p>Đăng nhập để lưu giỏ hàng, sản phẩm yêu thích và theo dõi đơn mua.</p>
    <form
      class="auth-form"
      (submit)="
        $event.preventDefault();
        submit()
      "
    >
      @if (mode === 'register') {
        <label
          >Họ tên<input
            name="name"
            autocomplete="name"
            required
            minlength="2"
            maxlength="100"
            [(ngModel)]="name"
        /></label>
      }
      <label
        >Email<input
          name="email"
          type="email"
          autocomplete="email"
          required
          maxlength="200"
          [(ngModel)]="email"
      /></label>
      <label
        >Mật khẩu<input
          name="password"
          type="password"
          [attr.autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
          required
          [attr.minlength]="mode === 'register' ? 10 : 1"
          maxlength="128"
          [(ngModel)]="password"
      /></label>
      @if (mode === 'register') {
        <small class="muted">Mật khẩu từ 10 đến 128 ký tự. Tài khoản mới có quyền khách hàng.</small>
      }
      <button class="button black full" [disabled]="shop.busy">
        {{ shop.busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký' }}
      </button>
    </form>
    @if (mode === 'login') {
      <button class="text-button auth-toggle" [disabled]="shop.busy" (click)="shop.go('/quen-mat-khau')">
        Quên mật khẩu?
      </button>
    }
    <button class="text-button auth-toggle" [disabled]="shop.busy" (click)="toggleMode()">
      {{ mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập' }}
    </button>
  </div>`,
})
export class AuthFormComponent {
  shop = inject(ShopService);
  mode: 'login' | 'register' = 'login';
  name = '';
  email = '';
  password = '';

  toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.password = '';
  }

  submit() {
    void this.shop.run(async () => {
      await api('auth/' + this.mode, 'POST', { name: this.name, email: this.email, password: this.password });
      this.password = '';
      await this.shop.reload();
    }, this.mode === 'login' ? 'Đã đăng nhập.' : 'Đã tạo tài khoản.');
  }
}
