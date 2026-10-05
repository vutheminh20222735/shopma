import { Component, OnInit, inject } from '@angular/core';
import type { MemberOffer, MyOffers, OfferStatus } from './types';
import { offerTitle } from './types';
import { ShopService } from '../../shop/shop.service';
import { dateTime, money, ymdLabel } from '../../shared/formatters';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { IconsComponent } from '../../shared/icons.component';

type OfferTab = 'active' | 'used' | 'expired';

@Component({
  selector: 'app-my-offers-page',
  standalone: true,
  imports: [EmptyComponent, LoaderComponent, IconsComponent],
  template: `<main class="container section offers-page">
    <p class="breadcrumb">
      <a href="/tai-khoan" (click)="nav($event, '/tai-khoan')">Tài khoản</a> / Ưu đãi của tôi
    </p>
    <div class="section-heading">
      <div>
        <p class="eyebrow">MY M&A</p>
        <h1>Ưu đãi của tôi</h1>
      </div>
      <button class="text-button" (click)="load()"><app-icon name="refresh-cw" [size]="15" />Tải lại</button>
    </div>

    @if (!shop.loaded) {
      <app-loader />
    } @else if (!shop.session.user) {
      <app-empty title="Đăng nhập để xem ưu đãi" text="Ưu đãi chào mừng, sinh nhật và kỷ niệm gắn với tài khoản của bạn.">
        <button class="button black" (click)="shop.go('/tai-khoan')">Đăng nhập</button>
      </app-empty>
    } @else if (shop.isTeam) {
      <app-empty
        title="Ưu đãi dành cho tài khoản khách hàng"
        text="Tài khoản nhân sự không nhận ưu đãi thành viên. Cấu hình ưu đãi nằm trong khu vực quản trị."
      >
        <button class="button black" (click)="shop.go('/quan-tri')">Vào khu vực làm việc</button>
      </app-empty>
    } @else if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    } @else if (!data) {
      <app-loader />
    } @else {
      <div class="offer-rules">
        <app-icon name="tag" [size]="18" />
        <p>
          Mỗi đơn hàng chỉ dùng <strong>một mã</strong>: mã ưu đãi thành viên <strong>hoặc</strong> mã giảm giá thường,
          không cộng dồn. Mã thành viên chỉ dùng được một lần và sẽ được hoàn lại nếu đơn bị hủy.
        </p>
      </div>

      <div class="offer-status-grid">
        <div class="admin-panel">
          <h2>Số điện thoại</h2>
          @if (data.phone.e164 && data.phone.verified) {
            <p><span class="verified-badge"><app-icon name="badge-check" [size]="14" />Đã xác minh</span> {{ data.phone.e164 }}</p>
          } @else if (data.phone.e164) {
            <p>{{ data.phone.e164 }} <span class="pill">Chưa xác minh</span></p>
            <p class="muted">Xác minh bằng mã OTP để nhận ưu đãi chào mừng và sinh nhật.</p>
          } @else {
            <p class="muted">Bạn chưa thêm số điện thoại. Ưu đãi chào mừng chỉ được cấp sau khi có số điện thoại.</p>
          }
          @if (!data.phone.verified) {
            <button class="button outline small" (click)="shop.go('/tai-khoan')">Cập nhật & xác minh</button>
          }
        </div>

        <div class="admin-panel">
          <h2>Ưu đãi sinh nhật</h2>
          @if (data.birthday.claimed) {
            <p><span class="verified-badge"><app-icon name="badge-check" [size]="14" />Đã nhận</span> Bạn đã nhận ưu đãi sinh nhật năm nay.</p>
          } @else if (data.birthday.in_welcome_window) {
            <p class="muted">
              Sinh nhật của bạn rơi vào thời hạn ưu đãi chào mừng nên hệ thống chỉ hiển thị mã chào mừng.
            </p>
          } @else if (data.birthday.eligible) {
            <p>
              Bạn đủ điều kiện nhận ưu đãi sinh nhật{{ data.birthday.birthday_date ? ' (' + ymd(data.birthday.birthday_date) + ')' : '' }}.
              Mã sẽ xuất hiện ở danh sách bên dưới.
            </p>
          } @else {
            <p class="muted">Bạn chưa nhận được ưu đãi sinh nhật vì:</p>
            <ul class="reason-list">
              @for (r of data.birthday.reasons; track r) {
                <li>{{ r }}</li>
              }
            </ul>
            @if (data.birthday.birthday_date) {
              <p class="muted">Ngày sinh nhật tính ưu đãi gần nhất: {{ ymd(data.birthday.birthday_date) }}</p>
            }
            <button class="button outline small" (click)="shop.go('/tai-khoan')">Cập nhật hồ sơ</button>
          }
        </div>
      </div>

      <div class="category-tabs order-tabs" role="tablist">
        @for (t of tabs; track t.id) {
          <button
            role="tab"
            [attr.aria-selected]="tab === t.id"
            [class.active]="tab === t.id"
            (click)="tab = t.id"
          >
            {{ t.label }} ({{ list(t.id).length }})
          </button>
        }
      </div>

      @if (list(tab).length) {
        <div class="offer-list">
          @for (o of list(tab); track o.id) {
            <article [class]="'offer-card ' + o.status">
              <div class="offer-card-top">
                <div>
                  <span class="eyebrow">{{ title(o).toUpperCase() }}</span>
                  <strong class="offer-percent">Giảm {{ o.percent }}%</strong>
                </div>
                <span [class]="'status offer-' + o.status">{{ statusLabel[o.status] }}</span>
              </div>
              <ul class="offer-conditions">
                <li>Tối đa {{ money(o.max_discount) }} mỗi đơn</li>
                <li>{{ o.minimum ? 'Đơn từ ' + money(o.minimum) : 'Không yêu cầu giá trị đơn tối thiểu' }}</li>
                <li>Hiệu lực: {{ date(o.starts_at) }} – {{ date(o.expires_at) }}</li>
                @if (o.used_at) {
                  <li>Đã dùng lúc {{ date(o.used_at) }}</li>
                }
                <li>Dùng một lần · không cộng dồn với mã khác</li>
              </ul>
              <div class="offer-code-row">
                <code>{{ o.code }}</code>
                @if (o.status === 'active') {
                  <button class="text-button" (click)="copy(o.code)"><app-icon name="copy" [size]="15" />Sao chép</button>
                  <button class="button black small" (click)="shop.go('/gio-hang')">Dùng khi thanh toán</button>
                }
              </div>
            </article>
          }
        </div>
      } @else {
        <app-empty
          [title]="emptyTitle[tab]"
          text="Ưu đãi mới sẽ xuất hiện khi bạn đủ điều kiện nhận."
        />
      }
    }
  </main>`,
})
export class OffersPageComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  date = dateTime;
  ymd = ymdLabel;

  data: MyOffers | null = null;
  error = '';
  tab: OfferTab = 'active';
  tabs: { id: OfferTab; label: string }[] = [
    { id: 'active', label: 'Đang hiệu lực' },
    { id: 'used', label: 'Đã sử dụng' },
    { id: 'expired', label: 'Hết hạn' },
  ];
  statusLabel: Record<OfferStatus, string> = {
    active: 'Dùng được',
    upcoming: 'Chưa đến hạn',
    used: 'Đã dùng',
    expired: 'Hết hạn',
  };
  emptyTitle: Record<OfferTab, string> = {
    active: 'Chưa có ưu đãi đang hiệu lực',
    used: 'Bạn chưa dùng ưu đãi nào',
    expired: 'Không có ưu đãi hết hạn',
  };

  ngOnInit() {
    void this.load();
  }

  async load() {
    if (!this.shop.session.user) {
      // phiên có thể chưa tải xong khi mở trực tiếp /uu-dai
      await this.waitForSession();
      if (!this.shop.session.user || this.shop.isTeam) return;
    }
    if (this.shop.isTeam) return;
    try {
      this.data = await this.shop.getMyOffers();
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  private async waitForSession() {
    for (let i = 0; i < 40 && !this.shop.loaded; i++) await new Promise((r) => setTimeout(r, 100));
  }

  list(tab: OfferTab): MemberOffer[] {
    const offers = this.data?.offers || [];
    if (tab === 'active') return offers.filter((o) => o.status === 'active' || o.status === 'upcoming');
    return offers.filter((o) => o.status === tab);
  }

  title(o: MemberOffer) {
    return offerTitle(o);
  }

  async copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.shop.notify('Đã sao chép mã ' + code + '.');
    } catch {
      this.shop.notify('Không thể sao chép. Hãy chọn và sao chép mã thủ công.', true);
    }
  }

  nav(e: Event, path: string) {
    e.preventDefault();
    this.shop.go(path);
  }
}
