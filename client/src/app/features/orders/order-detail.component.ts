import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Member } from '../accounts/types';
import type { OrderDetail } from './types';
import { eventNames, paymentMethodNames, paymentStatusNames, shipmentStatusNames, statusNames } from './types';
import { money, dateTime } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { IconsComponent } from '../../shared/icons.component';

type Item = OrderDetail['items'][number];

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [FormsModule, LoaderComponent, IconsComponent],
  template: `@if (error && !o) {
      <p class="form-error" role="alert">{{ error }}</p>
    } @else if (!o) {
      <app-loader />
    } @else {
      <div class="order-detail">
        <div class="order-detail-top">
          <span [class]="'status ' + o.status">{{ statusNames[o.status] }}</span>
          <span class="muted">Đặt lúc {{ date(o.created_at) }}</span>
          @if (manage) {
            <span class="muted">· Khách: {{ o.customer_name }}</span>
          }
        </div>
        @if (!manage && o.received) {
          <p class="order-received detail-received">
            <app-icon name="package-check" [size]="16" />Bạn đã nhận đơn hàng này
            @if (o.all_reviewed) {
              <span>· Đã đánh giá sản phẩm</span>
            } @else if (o.review_pending?.length) {
              <span>· Còn {{ o.review_pending!.length }} sản phẩm chưa đánh giá</span>
            }
          </p>
        }

        @if (o.status !== 'cancelled') {
          <div class="order-stepper">
            @for (s of stages; track s; let i = $index) {
              <span [class.done]="stageIndex(o.status) >= i"
                ><b>{{ i + 1 }}</b
                >{{ statusNames[s] }}</span
              >
            }
          </div>
        }

        <h3>Sản phẩm</h3>
        @for (i of o.items; track i.variant_id + $index) {
          <div class="order-detail-item">
            <img [src]="i.image" [alt]="i.name" />
            <div>
              <strong>{{ i.name }}</strong>
              <p>Màu {{ i.color }} · Size {{ i.size }} · SL {{ i.quantity }}</p>
              <p>Đơn giá {{ money(i.price) }} <span class="muted">(giá tại thời điểm đặt)</span></p>
              @if (canChange) {
                <button class="text-button" (click)="openResize(i)">Đổi size</button>
              }
              @if (i.can_review) {
                <button class="text-button" (click)="goReview(i)">Đánh giá sản phẩm</button>
              } @else if (i.reviewed) {
                <span class="muted">Đã đánh giá</span>
              }
            </div>
            <strong>{{ money(i.price * i.quantity) }}</strong>
          </div>
          @if (resizing && resizing.variant_id === i.variant_id) {
            <div class="resize-box">
              @if (sizesLoading) {
                <span class="muted">Đang kiểm tra size còn hàng…</span>
              } @else if (!sizeOptions.length) {
                <span class="muted">Hiện không có size khác còn hàng cho màu {{ i.color }}.</span>
              } @else {
                <label
                  >Chọn size mới
                  <select [(ngModel)]="newSize" name="newSize">
                    <option value="">— Chọn size —</option>
                    @for (s of sizeOptions; track s) {
                      <option [value]="s">{{ s }}</option>
                    }
                  </select>
                </label>
                <button class="button black small" [disabled]="busy || !newSize" (click)="resize()">Xác nhận đổi size</button>
              }
              <button class="text-button" (click)="resizing = null">Đóng</button>
            </div>
          }
        }

        <div class="summary-row"><span>Tạm tính</span><strong>{{ money(o.subtotal) }}</strong></div>
        <div class="summary-row discount">
          <span>Ưu đãi{{ o.coupon_code ? ' (' + o.coupon_code + ')' : '' }}</span
          ><strong>−{{ money(o.discount) }}</strong>
        </div>
        <div class="summary-row">
          <span>Phí giao hàng</span><strong>{{ o.shipping ? money(o.shipping) : 'Miễn phí' }}</strong>
        </div>
        <div class="summary-total">
          <span>Tổng cộng</span><strong>{{ money(o.total) }}</strong>
        </div>

        <div class="order-info-grid">
          <div>
            <h3>Người nhận</h3>
            <p>{{ o.customer_name }} · {{ o.phone }}<br />{{ o.address }}</p>
            @if (o.note) {
              <p class="muted">Ghi chú: {{ o.note }}</p>
            }
          </div>
          <div>
            <h3>Thanh toán</h3>
            <p>
              {{ paymentMethodNames[o.payment] || o.payment }}<br />
              <span [class]="'status pay-' + (o.payment_status || 'unpaid')">{{
                paymentStatusNames[o.payment_status || 'unpaid'] || o.payment_status
              }}</span>
            </p>
            @if (o.refund_info.status === 'pending') {
              <p class="muted">
                Đang chờ hoàn tiền {{ o.refund_info.refund ? money(o.refund_info.refund.amount) : '' }}. Cửa hàng sẽ xác nhận
                khi đã hoàn.
              </p>
            } @else if (o.refund_info.status === 'refunded') {
              <p class="muted">Đã hoàn tiền {{ o.refund_info.refund ? money(o.refund_info.refund.amount) : '' }}.</p>
            }
            @if (o.payment === 'transfer' && o.payment_status === 'unpaid' && o.status !== 'cancelled') {
              <p class="unavailable-note">
                <app-icon name="clock" [size]="15" />Cổng thanh toán trực tuyến hiện chưa khả dụng. Đơn chỉ được ghi nhận
                "Đã thanh toán" khi cửa hàng xác nhận đã nhận chuyển khoản.
              </p>
            } @else if (o.payment === 'cod' && o.payment_status === 'unpaid' && o.status !== 'cancelled') {
              <p class="muted">Thu tiền khi giao hàng thành công.</p>
            }
          </div>
          <div>
            <h3>Vận chuyển</h3>
            @if (o.tracking.code || o.tracking_code) {
              <p>
                Mã vận đơn: <strong>{{ o.tracking.code || o.tracking_code }}</strong
                ><br />
                @if (o.tracking.shipment) {
                  {{ shipmentStatusNames[o.tracking.shipment.status] || o.tracking.shipment.status }}
                  <span class="muted"> · cập nhật {{ date(o.tracking.shipment.updated_at) }}</span>
                }
              </p>
              @if (!o.tracking.shipment || o.tracking.shipment.provider === 'stub') {
                <p class="unavailable-note">
                  <app-icon name="clock" [size]="15" />Chưa kết nối đơn vị vận chuyển thật. Mã vận đơn do cửa hàng tạo nội
                  bộ, chưa có hành trình vận chuyển tự động.
                </p>
              }
            } @else {
              <p class="muted">Chưa có mã vận đơn.</p>
              <p class="unavailable-note">
                <app-icon name="clock" [size]="15" />Đơn vị vận chuyển chưa được kết nối; cửa hàng sẽ liên hệ khi giao hàng.
              </p>
            }
          </div>
        </div>

        @if (manage) {
          <h3>Dòng thời gian đơn hàng</h3>
          <ol class="timeline">
            @for (e of o.events; track e.id) {
              <li [class]="'timeline-item ev-' + e.status">
                <span class="timeline-dot"></span>
                <div>
                  <strong>{{ eventNames[e.status] || e.status }}</strong>
                  <span class="muted">{{ date(e.created_at) }} · {{ e.actor_name || 'Hệ thống' }}</span>
                  @if (e.note) {
                    <p>{{ e.note }}</p>
                  }
                </div>
              </li>
            } @empty {
              <li class="muted">Chưa có mốc nào được ghi nhận.</li>
            }
          </ol>
        }

        @if (error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        @if (!manage && o.status !== 'pending' && o.status !== 'cancelled') {
          <p class="lock-note">
            <app-icon name="shield-check" [size]="16" />Đơn đã được cửa hàng xác nhận nên không thể tự hủy hoặc đổi size.
            Cần hỗ trợ? <button class="text-button" (click)="shop.go('/lien-he')">Liên hệ cửa hàng</button>
          </p>
        }

        <div class="order-detail-actions">
          @if (manage) {
            @if (nextStatus[o.status]) {
              <button class="button black small" [disabled]="busy" (click)="advance()">
                {{ statusNames[nextStatus[o.status]] }}
              </button>
            }
            @if (canCreateShipment) {
              <button class="button outline small" [disabled]="busy" (click)="makeShipment()">Tạo mã vận đơn</button>
            }
            @if (shop.isManagement && o.payment_status === 'unpaid' && o.status !== 'cancelled') {
              <button class="button outline small" [disabled]="busy" (click)="markPaid()">Xác nhận đã nhận tiền</button>
            }
            @if (shop.isManagement && o.refund_info.status === 'pending') {
              <button class="button outline small" [disabled]="busy" (click)="refund()">Xác nhận đã hoàn tiền</button>
            }
          }
          @if (canCancel) {
            <button class="text-button danger" [disabled]="busy" (click)="cancelOpen = !cancelOpen">Hủy đơn</button>
          }
        </div>

        @if (cancelOpen) {
          <div class="resize-box">
            <label
              >Lý do hủy (không bắt buộc)
              <input maxlength="300" [(ngModel)]="cancelNote" name="cancelNote" />
            </label>
            <button class="button black small" [disabled]="busy" (click)="cancel()">Xác nhận hủy đơn</button>
            <button class="text-button" (click)="cancelOpen = false">Giữ đơn</button>
          </div>
        }
      </div>
    }`,
})
export class OrderDetailComponent implements OnChanges {
  shop = inject(ShopService);
  @Input({ required: true }) orderId!: string;
  @Input({ required: true }) manage!: boolean;
  @Input({ required: true }) user!: Member;
  @Output() changed = new EventEmitter<void>();

  o: OrderDetail | null = null;
  error = '';
  busy = false;

  money = money;
  date = dateTime;
  statusNames = statusNames;
  eventNames = eventNames;
  paymentMethodNames = paymentMethodNames;
  paymentStatusNames = paymentStatusNames;
  shipmentStatusNames = shipmentStatusNames;
  stages = ['pending', 'confirmed', 'packing', 'shipping', 'delivered'];
  nextStatus: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'packing',
    packing: 'shipping',
    shipping: 'delivered',
  };

  cancelOpen = false;
  cancelNote = '';
  resizing: Item | null = null;
  sizeOptions: string[] = [];
  sizesLoading = false;
  newSize = '';

  /** Khách chỉ đổi size/hủy khi đơn còn chờ xác nhận; sau khi xác nhận thì khóa. */
  get canChange() {
    return !this.manage && this.o?.status === 'pending';
  }

  get canCancel() {
    if (!this.o) return false;
    if (!this.manage) return this.o.status === 'pending';
    return this.user.role !== 'staff' && ['pending', 'confirmed', 'packing'].includes(this.o.status);
  }

  get canCreateShipment() {
    return !!this.o && ['packing', 'shipping'].includes(this.o.status) && !(this.o.tracking.code || this.o.tracking_code);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['orderId']) {
      this.o = null;
      this.resizing = null;
      this.cancelOpen = false;
      void this.load();
    }
  }

  stageIndex(status: string) {
    return this.stages.indexOf(status);
  }

  async load(keepError = false) {
    try {
      this.o = await this.shop.getOrder(this.orderId);
      if (!keepError) this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  private async act(fn: () => Promise<unknown>, message: string) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await fn();
      this.shop.notify(message);
      this.cancelOpen = false;
      this.resizing = null;
      await this.load();
      this.changed.emit();
    } catch (e) {
      this.error = (e as Error).message;
      // Tải lại để hiển thị trạng thái mới nhất khi bị xung đột phiên bản.
      await this.load(true);
    } finally {
      this.busy = false;
    }
  }

  advance() {
    const o = this.o;
    if (!o || !this.nextStatus[o.status]) return;
    void this.act(() => this.shop.setOrderStatus(o.id, this.nextStatus[o.status], o.version), 'Đã cập nhật đơn hàng.');
  }

  cancel() {
    const o = this.o;
    if (!o) return;
    void this.act(() => this.shop.cancelOrder(o.id, this.cancelNote.trim(), o.version), 'Đã hủy đơn hàng.');
  }

  makeShipment() {
    const o = this.o;
    if (!o) return;
    void this.act(() => this.shop.createShipment(o.id), 'Đã tạo mã vận đơn.');
  }

  markPaid() {
    const o = this.o;
    if (!o) return;
    void this.act(() => this.shop.confirmPayment(o.id), 'Đã ghi nhận thanh toán.');
  }

  refund() {
    const o = this.o;
    if (!o) return;
    void this.act(() => this.shop.confirmRefund(o.id), 'Đã xác nhận hoàn tiền.');
  }

  async openResize(item: Item) {
    this.resizing = item;
    this.newSize = '';
    this.sizeOptions = [];
    this.sizesLoading = true;
    this.error = '';
    try {
      const p = await this.shop.getProduct(item.product_id);
      this.sizeOptions = (p.sizes || []).filter(
        (s) => s !== item.size && (p.variants || []).some((v) => v.size === s && v.color === item.color && v.stock >= item.quantity),
      );
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.sizesLoading = false;
    }
  }

  goReview(item: Item) {
    this.shop.go('/san-pham/' + item.product_id);
    setTimeout(() => document.getElementById('danh-gia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  }

  resize() {
    const o = this.o;
    const item = this.resizing;
    if (!o || !item || !this.newSize) return;
    const size = this.newSize;
    void this.act(async () => {
      const r = await this.shop.resizeOrderItem(o.id, item.variant_id, size, o.version);
      if (r.price_delta) this.shop.notify('Giá đơn hàng thay đổi ' + money(r.price_delta) + ' sau khi đổi size.');
    }, 'Đã đổi size.');
  }
}
