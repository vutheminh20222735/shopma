import { Component, OnInit, DoCheck, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { Order } from '../orders/types';
import type { AppliedOffer, MemberOffer } from '../offers/types';
import type { SavedAddress } from '../addresses/types';
import { offerTitle } from '../offers/types';
import { api } from '../../shared/api';
import { dateOnly, money } from '../../shared/formatters';
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
          Đơn đang chờ cửa hàng xác nhận. Cổng thanh toán trực tuyến và đơn vị vận chuyển thật chưa được kết nối: bạn
          chưa bị trừ tiền, cửa hàng sẽ liên hệ để xác nhận thanh toán và giao hàng.
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
                @if (addresses.length && !addingNewAddress) {
                  <div class="saved-address-picker">
                    <p class="muted">Chọn địa chỉ đã lưu</p>
                    <ul>
                      @for (a of addresses; track a.id) {
                        <li>
                          <button
                            type="button"
                            class="address-pick"
                            [class.selected]="selectedAddressId === a.id"
                            (click)="useAddress(a)"
                          >
                            <strong>{{ a.label || a.recipient_name }}</strong>
                            @if (a.is_default) {
                              <span class="pill">Mặc định</span>
                            }
                            <span>{{ a.recipient_name }} · {{ a.phone }}</span>
                            <span class="muted">{{ a.address }}</span>
                          </button>
                        </li>
                      }
                    </ul>
                    <div class="address-picker-actions">
                      <button type="button" class="button outline small" (click)="startNewAddress()">
                        <app-icon name="plus" [size]="16" />Thêm địa chỉ mới
                      </button>
                      <button type="button" class="text-button" (click)="shop.go('/tai-khoan')">Quản lý sổ địa chỉ</button>
                    </div>
                  </div>
                } @else {
                  @if (addresses.length && addingNewAddress) {
                    <button type="button" class="text-button back-to-saved" (click)="cancelNewAddress()">
                      ← Quay lại địa chỉ đã lưu
                    </button>
                  }
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
                      pattern="\\+?[0-9\\s().-]{8,20}"
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
                  <label class="check-row"
                    ><input type="checkbox" [(ngModel)]="saveAddress" name="saveAddress" />Lưu địa chỉ này để dùng lần sau</label
                  >
                }
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
                    <strong>Thanh toán khi nhận hàng (COD)</strong><span>Thanh toán bằng tiền mặt khi nhận hàng. Chưa thu tiền trực tuyến.</span>
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
                    <strong>Chuyển khoản ngân hàng</strong><span>Cổng thanh toán trực tuyến chưa khả dụng. Cửa hàng sẽ gửi thông tin chuyển khoản và xác nhận thủ công khi nhận được tiền.</span>
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
            <form
              class="coupon-form"
              (submit)="$event.preventDefault(); applyCoupon()"
            >
              <input
                aria-label="Mã ưu đãi"
                placeholder="Nhập mã ưu đãi"
                autocomplete="off"
                [(ngModel)]="code"
                name="code"
              />
              <button type="submit" [disabled]="shop.busy || !code.trim()">Áp dụng</button>
            </form>
            <p class="muted offer-one-note">Mỗi đơn dùng một mã: ưu đãi thành viên hoặc mã giảm giá, không cộng dồn.</p>
            @if (offerError) {
              <p class="form-error" role="alert">{{ offerError }}</p>
            }
            @if (coupon) {
              <p class="coupon-applied">
                {{ coupon.code }}: giảm {{ coupon.percent }}%{{ coupon.max_discount ? ' (tối đa ' + money(coupon.max_discount) + ')' : '' }}
                · {{ coupon.source === 'member_offer' ? 'Ưu đãi thành viên' : 'Mã giảm giá' }}
                <button (click)="clearOffer()" aria-label="Bỏ mã">
                  <app-icon name="x" [size]="13" />
                </button>
              </p>
            }
            @if (myOffers.length) {
              <div class="offer-picker">
                <span class="muted">Ưu đãi của bạn</span>
                @for (o of myOffers; track o.id) {
                  <button
                    type="button"
                    [class.selected]="coupon?.code === o.code"
                    [disabled]="shop.busy || subtotal < o.minimum"
                    [title]="subtotal < o.minimum ? 'Đơn cần từ ' + money(o.minimum) : 'Hạn dùng ' + dateOnly(o.expires_at)"
                    (click)="pickOffer(o)"
                  >
                    <strong>{{ offerName(o) }} · {{ o.percent }}%</strong>
                    <small>{{ o.code }} · HSD {{ dateOnly(o.expires_at) }}</small>
                  </button>
                }
              </div>
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
                {{ shop.busy ? 'Đang đặt hàng…' : 'Đặt hàng' }}
              </button>
            } @else {
              <button class="button black full" (click)="shop.go('/thanh-toan')">Tiến hành đặt hàng</button>
            }
            <p class="summary-note"><app-icon name="shield-check" [size]="15" />Chưa thu tiền trực tuyến · cửa hàng xác nhận đơn</p>
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

  dateOnly = dateOnly;
  code = '';
  coupon: AppliedOffer | null = null;
  offerError = '';
  myOffers: MemberOffer[] = [];
  addresses: SavedAddress[] = [];
  selectedAddressId: string | null = null;
  addingNewAddress = false;
  saveAddress = false;
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
    if (!this.coupon || this.subtotal < this.coupon.minimum) return 0;
    const raw = Math.round((this.subtotal * this.coupon.percent) / 100);
    return this.coupon.max_discount ? Math.min(raw, this.coupon.max_discount) : raw;
  }

  private userId: string | undefined;

  ngOnInit() {
    this.route.data.subscribe((d) => {
      this.checkout = !!d['checkout'];
      this.resetCheckoutState();
      this.applyDefaultAddress();
    });
    this.userId = this.shop.session.user?.id;
    this.resetCheckoutState();
    void this.loadMyOffers();
    void this.loadAddresses();
  }

  ngDoCheck() {
    const uid = this.shop.session.user?.id;
    if (uid !== this.userId) {
      this.userId = uid;
      this.resetCheckoutState();
      void this.loadMyOffers();
      void this.loadAddresses();
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
    this.selectedAddressId = null;
    this.addingNewAddress = false;
    this.saveAddress = false;
    this.coupon = null;
    this.code = '';
    this.offerError = '';
    this.order = null;
    this.idempotencyKey = crypto.randomUUID();
  }

  private applyDefaultAddress() {
    const preferred = this.addresses.find((a) => a.is_default) || this.addresses[0];
    if (preferred) this.useAddress(preferred);
  }

  offerName(o: MemberOffer) {
    return offerTitle(o);
  }

  private async loadAddresses() {
    this.addresses = [];
    this.selectedAddressId = null;
    if (!this.shop.session.user || this.shop.isTeam) return;
    try {
      this.addresses = await this.shop.listAddresses();
      this.applyDefaultAddress();
    } catch {
      /* sổ địa chỉ chỉ hỗ trợ; vẫn nhập tay được */
    }
  }

  useAddress(a: SavedAddress) {
    this.addingNewAddress = false;
    this.selectedAddressId = a.id;
    this.form.customer_name = a.recipient_name;
    this.form.phone = a.phone;
    this.form.address = a.address;
    this.saveAddress = false;
  }

  startNewAddress() {
    this.addingNewAddress = true;
    this.selectedAddressId = null;
    this.form.customer_name = this.shop.session.user?.name || '';
    this.form.phone = '';
    this.form.address = '';
    this.saveAddress = true;
  }

  cancelNewAddress() {
    this.addingNewAddress = false;
    this.saveAddress = false;
    this.applyDefaultAddress();
  }

  private async loadMyOffers() {
    this.myOffers = [];
    if (!this.shop.session.user || this.shop.isTeam) return;
    try {
      const res = await this.shop.getMyOffers();
      this.myOffers = res.offers.filter((o) => o.status === 'active');
    } catch {
      /* ưu đãi chỉ là gợi ý; có thể vẫn nhập mã thủ công */
    }
  }

  pickOffer(o: MemberOffer) {
    this.code = o.code;
    this.applyCoupon();
  }

  clearOffer() {
    this.coupon = null;
    this.code = '';
    this.offerError = '';
  }

  /** Kiểm tra mã với máy chủ: mã thành viên hoặc coupon thường; áp dụng mã mới sẽ thay mã cũ (không cộng dồn). */
  async applyCoupon() {
    if (!this.shop.requireLogin()) return;
    const code = this.code.trim().toUpperCase();
    if (!code) return;
    this.offerError = '';
    await this.shop.run(async () => {
      try {
        this.coupon = await this.shop.applyOffer(code, this.subtotal);
        this.code = this.coupon.code;
      } catch (e) {
        this.coupon = null;
        this.offerError = (e as Error).message;
        throw e;
      }
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

  /** Chỉ gửi MỘT mã: server từ chối nếu có cả coupon và offer_code. */
  private offerPayload() {
    if (!this.coupon || this.subtotal < this.coupon.minimum) return {};
    return this.coupon.source === 'member_offer' ? { offer_code: this.coupon.code } : { coupon: this.coupon.code };
  }

  placeOrder(e: Event) {
    e.preventDefault();
    void this.shop.run(async () => {
      const o = await api<Order>('orders', 'POST', {
        ...this.form,
        ...this.offerPayload(),
        idempotency_key: this.idempotencyKey,
      });
      if (this.saveAddress && !this.selectedAddressId) {
        try {
          await this.shop.createAddress({
            recipient_name: this.form.customer_name,
            phone: this.form.phone,
            address: this.form.address,
            is_default: !this.addresses.length,
          });
        } catch {
          /* đặt hàng đã thành công; lưu địa chỉ thất bại không chặn */
        }
      }
      this.order = o;
      await this.shop.reload();
    });
  }
}
