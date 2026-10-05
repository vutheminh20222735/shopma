import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Profile } from '../offers/types';
import { ShopService } from '../../shop/shop.service';
import { todayVn, ymdLabel, dateTime } from '../../shared/formatters';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [FormsModule, IconsComponent],
  template: `<section class="profile-panel" aria-labelledby="profile-title">
    <div class="section-heading">
      <h2 id="profile-title">Hồ sơ nhận ưu đãi</h2>
      <button class="text-button" (click)="shop.go('/uu-dai')"><app-icon name="gift" [size]="16" />Ưu đãi của tôi</button>
    </div>
    @if (!profile) {
      <p class="muted">{{ error || 'Đang tải hồ sơ…' }}</p>
    } @else {
      <div class="profile-grid">
        <form class="editor-form" (submit)="saveBirthday($event)">
          <h3>Ngày sinh</h3>
          <label
            >Ngày sinh
            <input type="date" min="1900-01-01" [max]="today" [(ngModel)]="birthday" name="birthday" />
          </label>
          <p class="muted">
            Ưu đãi sinh nhật cần ngày sinh được cập nhật <strong>trước sinh nhật ít nhất 30 ngày</strong>. Mỗi lần đổi ngày
            sinh, mốc này được tính lại từ đầu.
            @if (profile.birthday_updated_at) {
              Lần cập nhật gần nhất: {{ updatedAt(profile.birthday_updated_at) }}.
            }
          </p>
          @if (birthdayError) {
            <p class="form-error" role="alert">{{ birthdayError }}</p>
          }
          <button class="button outline small" type="submit" [disabled]="savingBirthday || birthday === (profile.birthday || '')">
            {{ savingBirthday ? 'Đang lưu…' : 'Lưu ngày sinh' }}
          </button>
        </form>

        <div class="editor-form">
          <h3>Số điện thoại</h3>
          <form class="phone-row" (submit)="savePhone($event)">
            <label
              >Số điện thoại
              <input type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxx" [(ngModel)]="phone" name="phone" />
            </label>
            <button class="button outline small" type="submit" [disabled]="savingPhone || phone.trim() === (profile.phone_e164 || '')">
              {{ savingPhone ? 'Đang lưu…' : 'Lưu số' }}
            </button>
          </form>
          @if (phoneError) {
            <p class="form-error" role="alert">{{ phoneError }}</p>
          }
          @if (profile.phone_e164) {
            @if (profile.phone_verified) {
              <p><span class="verified-badge"><app-icon name="badge-check" [size]="14" />Đã xác minh</span> {{ profile.phone_e164 }}</p>
            } @else {
              <p class="muted">
                Số {{ profile.phone_e164 }} chưa được xác minh. Mã OTP có hiệu lực 5 phút; bạn có thể xin mã mới sau 60 giây.
              </p>
              <div class="otp-row">
                <button class="button outline small" type="button" [disabled]="sending || cooldown > 0" (click)="sendOtp()">
                  {{ cooldown > 0 ? 'Gửi lại sau ' + cooldown + 's' : sending ? 'Đang gửi…' : otpSent ? 'Gửi lại mã' : 'Gửi mã OTP' }}
                </button>
                <input
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  pattern="\\d{6}"
                  aria-label="Mã OTP gồm 6 chữ số"
                  placeholder="Mã 6 số"
                  [(ngModel)]="otp"
                  name="otp"
                />
                <button class="button black small" type="button" [disabled]="verifying || otp.length !== 6" (click)="verify()">
                  {{ verifying ? 'Đang xác minh…' : 'Xác minh' }}
                </button>
              </div>
              @if (otpSent) {
                <p class="unavailable-note">
                  <app-icon name="clock" [size]="15" />{{
                    otpMode === 'test'
                      ? 'Máy chủ đang ở chế độ thử OTP: chưa gửi SMS thật.'
                      : 'Mã đã được tạo nhưng nhà cung cấp SMS chưa được kết nối nên tin nhắn có thể chưa đến. Liên hệ cửa hàng nếu bạn không nhận được mã.'
                  }}
                </p>
              }
              @if (otpError) {
                <p class="form-error" role="alert">{{ otpError }}</p>
              }
            }
          } @else {
            <p class="muted">Thêm số điện thoại để nhận ưu đãi chào mừng và sinh nhật.</p>
          }
        </div>
      </div>
    }
  </section>`,
})
export class ProfileFormComponent implements OnInit, OnDestroy {
  shop = inject(ShopService);
  today = todayVn();

  profile: Profile | null = null;
  error = '';
  birthday = '';
  phone = '';

  savingBirthday = false;
  savingPhone = false;
  sending = false;
  verifying = false;
  birthdayError = '';
  phoneError = '';
  otpError = '';
  otp = '';
  otpSent = false;
  otpMode: 'live' | 'test' = 'live';
  cooldown = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    void this.load();
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  updatedAt(d: string) {
    return dateTime(d);
  }

  ymd(d: string) {
    return ymdLabel(d);
  }

  private apply(p: Profile) {
    this.profile = p;
    this.birthday = p.birthday || '';
    this.phone = p.phone_e164 || '';
  }

  async load() {
    try {
      this.apply(await this.shop.getProfile());
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  async saveBirthday(e: Event) {
    e.preventDefault();
    this.birthdayError = '';
    this.savingBirthday = true;
    try {
      this.apply(await this.shop.updateProfile({ birthday: this.birthday || null }));
      this.shop.notify('Đã cập nhật ngày sinh.');
      await this.shop.reload();
    } catch (err) {
      this.birthdayError = (err as Error).message;
    } finally {
      this.savingBirthday = false;
    }
  }

  async savePhone(e: Event) {
    e.preventDefault();
    this.phoneError = '';
    this.savingPhone = true;
    try {
      this.apply(await this.shop.updateProfile({ phone: this.phone.trim() || null }));
      this.otp = '';
      this.otpSent = false;
      this.shop.notify('Đã lưu số điện thoại. Hãy xác minh bằng mã OTP.');
      await this.shop.reload();
    } catch (err) {
      this.phoneError = (err as Error).message;
    } finally {
      this.savingPhone = false;
    }
  }

  async sendOtp() {
    if (!this.profile?.phone_e164) return;
    this.otpError = '';
    this.sending = true;
    try {
      const res = await this.shop.sendOtp(this.profile.phone_e164);
      this.otpSent = true;
      this.otpMode = res.mode;
      this.startCooldown(60);
      this.shop.notify('Đã tạo mã xác minh.');
    } catch (err) {
      this.otpError = (err as Error).message;
    } finally {
      this.sending = false;
    }
  }

  async verify() {
    this.otpError = '';
    this.verifying = true;
    try {
      const res = await this.shop.verifyOtp(this.otp.trim(), this.profile?.phone_e164 || undefined);
      this.shop.notify(res.welcome_granted ? 'Đã xác minh số điện thoại và nhận ưu đãi chào mừng.' : 'Đã xác minh số điện thoại.');
      this.otp = '';
      await this.load();
      await this.shop.reload();
    } catch (err) {
      this.otpError = (err as Error).message;
    } finally {
      this.verifying = false;
    }
  }

  private startCooldown(seconds: number) {
    this.cooldown = seconds;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.cooldown = Math.max(0, this.cooldown - 1);
      if (!this.cooldown && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }
}
