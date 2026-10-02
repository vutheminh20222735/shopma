import { Component, OnInit, DoCheck, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { Order } from '../orders/types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-cart-checkout-page',
  standalone: true,
  imports: [FormsModule, EmptyComponent, IconsComponent],
  template: `@if (order) {
      <main class="container section order-success">
        <div class="success-icon"><app-icon name="check" /></div>
        <p class="eyebrow">THANK YOU</p>
        <h1>Đã nhận đơn của bạn.</h1>
        <p>
          Mã đơn <strong>{{ order.id }}</strong> · {{ money(order.total) }}
        </p>
        <div class="sample-callout">
          Đây là đơn hàng mẫu để trải nghiệm. Bạn chưa bị trừ tiền và shop chưa giao hàng.
        </div>
        <div class="success-actions">
          <button class="button black" (click)="shop.go('/tai-khoan')">Theo dõi đơn hàng</button>
          <button class="button outline" (click)="shop.go('/san-pham')">Tiếp tục mua sắm</button>
        </div>
      </main>
    } @else if (!shop.cart.length) {
      <main class="container section">
        <h1>Giỏ hàng của bạn</h1>
        <app-empty
          title="Tủ đồ đang chờ món đầu tiên"
          text="Chọn một món đồ bạn thích để bắt đầu."
        >
          <button class="button black" (click)="shop.go('/san-pham')">Khám phá bộ sưu tập</button>
        </app-empty>
      </main>
    } @else {
      <main class="container section cart-page">
        <p class="breadcrumb">
          Giỏ hàng / {{ checkout ? 'Thông tin nhận hàng' : 'Sản phẩm đã chọn' }}
        </p>
        <h1>
          {{ checkout ? 'Hoàn tất đơn hàng' : 'Giỏ hàng của bạn' }}
          <span class="heading-count">({{ itemCount }})</span>
        </h1>
        <div class="cart-layout">
          <div>
            @if (checkout) {
              <form id="checkout-form" class="checkout-form" (submit)="placeOrder($event)">
                <h2>Thông tin nhận hàng</h2>
                <label
                  >Họ và tên<input
                    required
                    minlength="2"
                    maxlength="100"
                    autocomplete="name"
                    [(ngModel)]="form.customer_name"
                    name="customer_name"
                /></label>
                <label
                  >Số điện thoại<input
                    required
                    type="tel"
                    autocomplete="tel"
                    pattern="\+?[0-9\s().-]{8,20}"
                    placeholder="Số điện thoại người nhận"
                    [(ngModel)]="form.phone"
                    name="phone"
                /></label>
                <label
                  >Địa chỉ nhận hàng<textarea
                    required
                    minlength="10"
                    maxlength="500"
                    autocomplete="street-address"
                    placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
                    [(ngModel)]="form.address"
                    name="address"
                  ></textarea
                ></label>
                <label
                  >Ghi chú <span class="muted">(không bắt buộc)</span><textarea
                    [(ngModel)]="form.note"
                    name="note"
                    maxlength="1000"
                  ></textarea
                ></label>
                <h2>Phương thức thanh toán</h2>
                <label [class]="'payment-option' + (form.payment === 'cod' ? ' selected' : '')"
                  ><input
                    type="radio"
                    name="payment"
                    [checked]="form.payment === 'cod'"
                    (change)="form.payment = 'cod'"
                  />
                  <div>
                    <strong>Thanh toán khi nhận hàng (COD)</strong><span>Luồng đặt hàng mẫu, chưa thu tiền.</span>
                  </div></label
                >
                <label [class]="'payment-option' + (form.payment === 'transfer' ? ' selected' : '')"
                  ><input
                    type="radio"
                    name="payment"
                    [checked]="form.payment === 'transfer'"
                    (change)="form.payment = 'transfer'"
                  />
                  <div>
                    <strong>Chuyển khoản ngân hàng</strong><span>Chỉ mô phỏng lựa chọn. Không chuyển tiền.</span>
                  </div></label
                >
              </form>
            } @else {
              <div class="cart-items">
                @for (i of shop.cart; track i.id) {
                  <article class="cart-item">
                    <img [src]="i.product.image" [alt]="i.product.name" />
                    <div class="cart-item-info">
                      <button class="text-button" (click)="shop.go('/san-pham/' + i.product_id)">
                        <h3>{{ i.product.name }}</h3>
                      </button>
                      <p>{{ i.color }} / Size {{ i.size }}</p>
                      <strong>{{ money(i.product.price) }}</strong>
                      <div class="quantity">
                        <button
                          [disabled]="shop.busy || i.quantity <= 1"
                          [attr.aria-label]="'Giảm số lượng ' + i.product.name"
                          (click)="patchQty(i, i.quantity - 1)"
                        >
                          <app-icon name="minus" [size]="15" />
                        </button>
                        <span>{{ i.quantity }}</span>
                        <button
                          [disabled]="shop.busy || i.quantity >= Math.min(20, i.stock)"
                          [attr.aria-label]="'Tăng số lượng ' + i.product.name"
                          (click)="patchQty(i, i.quantity + 1)"
                        >
                          <app-icon name="plus" [size]="15" />
                        </button>
                      </div>
                    </div>
                    <div class="cart-item-end">
                      <strong>{{ money(i.product.price * i.quantity) }}</strong>
                      <button
                        class="icon-button"
                        [attr.aria-label]="'Xóa ' + i.product.name"
                        [disabled]="shop.busy"
                        (click)="removeItem(i.id)"
                      >
                        <app-icon name="trash-2" [size]="18" />
                      </button>
                    </div>
                  </article>
                }
              </div>
            }
            @if (!checkout) {
              <button class="text-button continue-shopping" (click)="shop.go('/san-pham')">
                Tiếp tục mua sắm <app-icon name="plus" [size]="17" />
              </button>
            }
          </div>
          <aside class="order-summary">
            <h2>Tóm tắt đơn hàng</h2>
            @if (checkout) {
              <div class="checkout-items">
                @for (i of shop.cart; track i.id) {
                  <div>
                    <span
                      >{{ i.product.name }} × {{ i.quantity }}<small>{{ i.color }} / {{ i.size }}</small></span
                    >
                    <strong>{{ money(i.product.price * i.quantity) }}</strong>
                  </div>
                }
              </div>
            }
            <div class="coupon-form">
              <input
                aria-label="Mã ưu đãi"
                placeholder="Mã ưu đãi (thử MA10)"
                [(ngModel)]="code"
                name="code"
              />
              <button [disabled]="shop.busy || !code" (click)="applyCoupon()">Áp dụng</button>
            </div>
            @if (coupon) {
              <p class="coupon-applied">
                {{ coupon.code }}: giảm {{ coupon.percent }}%
                <button (click)="coupon = null; code = ''" aria-label="Bỏ mã">
                  <app-icon name="x" [size]="13" />
                </button>
              </p>
            }
            <div class="summary-row">
              <span>Tạm tính</span><strong>{{ money(subtotal) }}</strong>
            </div>
            <div class="summary-row">
              <span>Phí giao hàng</span><strong>{{ shipping ? money(shipping) : 'Miễn phí' }}</strong>
            </div>
            @if (discount > 0) {
              <div class="summary-row discount">
                <span>Ưu đãi</span><strong>−{{ money(discount) }}</strong>
              </div>
            }
            <div class="summary-total">
              <span>Tổng cộng</span><strong>{{ money(subtotal - discount + shipping) }}</strong>
            </div>
            @if (checkout) {
              <button class="button black full" form="checkout-form" type="submit" [disabled]="shop.busy">
                {{ shop.busy ? 'Đang đặt hàng…' : 'Đặt hàng mẫu' }}
              </button>
            } @else {
              <button class="button black full" (click)="shop.go('/thanh-toan')">Tiến hành đặt hàng</button>
            }
            <p class="summary-note"><app-icon name="shield-check" [size]="15" />Bản trải nghiệm, chưa thu tiền</p>
            @if (shipping > 0) {
              <p class="muted">Thêm {{ money(699000 - subtotal) }} để được miễn phí giao hàng.</p>
            }
            @if (checkout) {
              <button class="text-button" (click)="shop.go('/gio-hang')">Sửa giỏ hàng</button>
            }
          </aside>
        </div>
      </main>
    }`,
})
export class CartCheckoutPageComponent implements OnInit, DoCheck {
  shop = inject(ShopService);
  private route = inject(ActivatedRoute);
  checkout = false;
  money = money;
  Math = Math;

  code = '';
  coupon: { code: string; percent: number; minimum: number } | null = null;
  order: Order | null = null;
  idempotencyKey = crypto.randomUUID();

  form = {
    customer_name: '',
    phone: '',
    address: '',
    note: '',
    payment: 'cod',
  };

  get itemCount() {
    return this.shop.cart.reduce((n, i) => n + i.quantity, 0);
  }

  get subtotal() {
    return this.shop.cart.reduce((n, i) => n + i.product.price * i.quantity, 0);
  }

  get shipping() {
    return this.subtotal >= 699000 ? 0 : 30000;
  }

  get discount() {
    return this.coupon && this.subtotal >= this.coupon.minimum
      ? Math.round((this.subtotal * this.coupon.percent) / 100)
      : 0;
  }

  private userId: string | undefined;

  ngOnInit() {
    this.route.data.subscribe((d) => {
      this.checkout = !!d['checkout'];
      this.resetCheckoutState();
    });
    this.userId = this.shop.session.user?.id;
    this.resetCheckoutState();
  }

  ngDoCheck() {
    const uid = this.shop.session.user?.id;
    if (uid !== this.userId) {
      this.userId = uid;
      this.resetCheckoutState();
    }
    if (this.coupon && this.subtotal < this.coupon.minimum) {
      this.coupon = null;
      this.code = '';
    }
  }

  private resetCheckoutState() {
    this.form = {
      customer_name: this.shop.session.user?.name || '',
      phone: '',
      address: '',
      note: '',
      payment: 'cod',
    };
    this.coupon = null;
    this.code = '';
    this.order = null;
    this.idempotencyKey = crypto.randomUUID();
  }

  applyCoupon() {
    void this.shop.run(async () => {
      const c = await api<any>('coupon', 'POST', { code: this.code });
      if (this.subtotal < c.minimum) throw new Error('Mã yêu cầu đơn từ ' + money(c.minimum));
      this.coupon = c;
    }, 'Đã áp dụng mã ưu đãi.');
  }

  patchQty(i: (typeof this.shop.cart)[0], quantity: number) {
    void this.shop.run(async () => {
      await api('cart', 'PATCH', {
        product_id: i.product_id,
        size: i.size,
        color: i.color,
        quantity,
      });
      await this.shop.reload();
    });
  }

  removeItem(id: string) {
    void this.shop.run(async () => {
      await api('cart/' + id, 'DELETE', {});
      await this.shop.reload();
    });
  }

  placeOrder(e: Event) {
    e.preventDefault();
    void this.shop.run(async () => {
      const o = await api<Order>('orders', 'POST', {
        ...this.form,
        coupon: this.coupon && this.subtotal >= this.coupon.minimum ? this.coupon.code : '',
        idempotency_key: this.idempotencyKey,
      });
      this.order = o;
      await this.shop.reload();
    });
  }
}
