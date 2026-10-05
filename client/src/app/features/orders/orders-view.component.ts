import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import type { Member } from '../accounts/types';
import type { Order } from './types';
import { statusNames } from './types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { IconsComponent } from '../../shared/icons.component';
import { OrderDetailComponent } from './order-detail.component';
import { OrderReviewFormComponent } from './order-review-form.component';

@Component({
  selector: 'app-orders-view',
  standalone: true,
  imports: [EmptyComponent, LoaderComponent, ModalComponent, IconsComponent, OrderDetailComponent, OrderReviewFormComponent],
  template: `<section class="orders-section">
    <div class="section-heading">
      <h2>{{ manage ? 'Danh sách đơn hàng' : 'Đơn hàng của tôi' }}</h2>
      <button class="text-button" (click)="load()"><app-icon name="refresh-cw" [size]="15" />Tải lại</button>
    </div>
    @if (manage) {
      <div class="category-tabs order-tabs">
        @for (v of filterTabs; track v) {
          <button [class.active]="filter === v" (click)="filter = v">{{ filterLabel(v) }}</button>
        }
      </div>
    }
    @if (!orders) {
      <app-loader />
    } @else if (visible.length) {
      <div class="order-list">
        @for (o of visible; track o.id) {
          <article class="order-card">
            <div class="order-card-top">
              <div>
                <strong>{{ o.id }}</strong
                ><span>{{ formatDate(o.created_at) }}</span>
              </div>
              <span [class]="'status ' + o.status">{{ statusNames[o.status] }}</span>
            </div>
            <div class="order-card-body">
              <img [src]="o.items[0].image" alt="Sản phẩm trong đơn" />
              <div>
                <h3>{{ manage ? o.customer_name : o.items[0].name }}</h3>
                <p>
                  {{ itemQty(o) }} sản phẩm · {{ o.payment === 'cod' ? 'COD' : 'Chuyển khoản' }}
                </p>
                <strong>{{ money(o.total) }}</strong>
                @if (!manage && o.received) {
                  <p class="order-received">
                    <app-icon name="package-check" [size]="15" />Đã nhận hàng
                    @if (o.all_reviewed) {
                      <span>· Đã đánh giá</span>
                    } @else if (o.review_pending?.length) {
                      <span>· Chưa đánh giá {{ o.review_pending!.length }} sản phẩm</span>
                    }
                  </p>
                }
              </div>
            </div>
            <div class="order-card-actions">
              @if (canReview(o)) {
                <button class="button small black" (click)="openReview(o)">
                  <app-icon name="package-check" [size]="15" />Đã nhận đơn
                </button>
              } @else {
                <button class="button small outline" (click)="selectedId = o.id">Chi tiết</button>
              }
              @if (manage && next[o.status]) {
                <button class="button small black" (click)="update(o, next[o.status])">
                  {{ statusNames[next[o.status]] }}
                </button>
              }
              @if (
                (!manage && o.status === 'pending') ||
                (manage && user.role !== 'staff' && ['pending', 'confirmed', 'packing'].includes(o.status))
              ) {
                <button class="text-button danger" (click)="cancel = o">Hủy đơn</button>
              }
            </div>
          </article>
        }
      </div>
    } @else {
      <app-empty
        [title]="'Chưa có đơn hàng'"
        [text]="
          manage ? 'Đơn mới sẽ xuất hiện ở đây khi khách đặt hàng.' : 'Đơn đã đặt sẽ xuất hiện ở đây để bạn theo dõi.'
        "
      />
    }
    @if (selectedId) {
      <app-modal [title]="'Đơn ' + selectedId" [wide]="true" (close)="closeDetail()">
        <app-order-detail
          [orderId]="selectedId"
          [manage]="manage"
          [user]="user"
          (changed)="load()"
        />
      </app-modal>
    }
    @if (reviewOrder) {
      <app-modal title="Đã nhận đơn — Đánh giá sản phẩm" (close)="closeReview()">
        <p class="muted review-confirm-note">Cảm ơn bạn đã nhận hàng. Hãy đánh giá sản phẩm để hoàn tất.</p>
        @if ((reviewOrder.review_pending?.length || 0) > 1 && !reviewProductId) {
          <p class="muted">Chọn sản phẩm chưa đánh giá:</p>
          <ul class="review-pick-list">
            @for (i of reviewOrder.review_pending!; track i.product_id) {
              <li>
                <button type="button" class="address-pick" (click)="pickReviewProduct(i.product_id, i.name)">
                  <strong>{{ i.name }}</strong>
                </button>
              </li>
            }
          </ul>
        } @else if (reviewProductId) {
          <app-order-review-form
            [productId]="reviewProductId"
            [productName]="reviewProductName"
            (cancel)="closeReview()"
            (done)="onReviewDone()"
          />
        }
        <button type="button" class="text-button" (click)="selectedId = reviewOrder!.id; closeReview()">
          Xem chi tiết đơn
        </button>
      </app-modal>
    }
    @if (cancel) {
      <app-modal title="Hủy đơn hàng này?" (close)="cancel = null">
        <p>Đơn {{ cancel.id }} sẽ được hủy. Số lượng sản phẩm sẽ được trả lại tồn kho.</p>
        <div class="modal-actions">
          <button class="button outline" (click)="cancel = null">Giữ đơn</button>
          <button class="button black" (click)="update(cancel, 'cancelled')">Xác nhận hủy</button>
        </div>
      </app-modal>
    }
  </section>`,
})
export class OrdersViewComponent implements OnInit, OnDestroy {
  @Input({ required: true }) manage!: boolean;
  @Input({ required: true }) user!: Member;

  shop = inject(ShopService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifications = inject(NotificationsService);
  private querySub?: { unsubscribe(): void };
  private liveSub?: Subscription;
  money = money;
  statusNames = statusNames;

  orders: Order[] | null = null;
  filter = 'all';
  selectedId: string | null = null;
  cancel: Order | null = null;
  reviewOrder: Order | null = null;
  reviewProductId: string | null = null;
  reviewProductName = '';

  filterTabs = ['all', 'pending', 'confirmed', 'packing', 'shipping', 'delivered', 'cancelled'];
  stages = ['pending', 'confirmed', 'packing', 'shipping', 'delivered'];
  next: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'packing',
    packing: 'shipping',
    shipping: 'delivered',
  };

  get visible() {
    if (!this.orders) return [];
    return this.orders.filter((o) => this.filter === 'all' || o.status === this.filter);
  }

  ngOnInit() {
    void this.load();
    this.querySub = this.route.queryParamMap.subscribe((q) => {
      const id = q.get('order');
      if (id) this.selectedId = id;
    });
    if (!this.manage) {
      this.liveSub = this.notifications.orderUpdates.subscribe((update) => {
        if (!this.orders) return;
        const idx = this.orders.findIndex((o) => o.id === update.id);
        if (idx < 0) {
          void this.load();
          return;
        }
        this.orders = this.orders.map((o) =>
          o.id === update.id
            ? {
                ...o,
                status: update.status,
                version: update.version ?? o.version,
                payment_status: update.payment_status ?? o.payment_status,
                refund_status: update.refund_status ?? o.refund_status,
              }
            : o,
        );
        if (this.selectedId === update.id) {
          // Modal chi tiết: tải lại để đồng bộ timeline/nút thao tác.
          this.selectedId = null;
          setTimeout(() => (this.selectedId = update.id), 0);
        }
      });
    }
  }

  ngOnDestroy() {
    this.querySub?.unsubscribe();
    this.liveSub?.unsubscribe();
  }

  closeDetail() {
    this.selectedId = null;
    if (this.route.snapshot.queryParamMap.has('order')) {
      void this.router.navigate([], { queryParams: { order: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  filterLabel(v: string) {
    return v === 'all' ? 'Tất cả' : statusNames[v];
  }

  formatDate(d: string) {
    return new Date(d).toLocaleString('vi-VN');
  }

  itemQty(o: Order) {
    return o.items.reduce((n, i) => n + i.quantity, 0);
  }

  canReview(o: Order) {
    if (this.manage) return false;
    return !!(o.review_pending && o.review_pending.length);
  }

  openReview(o: Order) {
    this.reviewOrder = o;
    const pending = o.review_pending || [];
    if (pending.length === 1) {
      this.reviewProductId = pending[0].product_id;
      this.reviewProductName = pending[0].name;
    } else {
      this.reviewProductId = null;
      this.reviewProductName = '';
    }
  }

  pickReviewProduct(productId: string, name: string) {
    this.reviewProductId = productId;
    this.reviewProductName = name;
  }

  closeReview() {
    this.reviewOrder = null;
    this.reviewProductId = null;
    this.reviewProductName = '';
  }

  onReviewDone() {
    this.closeReview();
    void this.load();
  }

  stageIndex(status: string) {
    return this.stages.indexOf(status);
  }

  async load() {
    try {
      this.orders = await api<Order[]>('orders' + (this.manage ? '?manage=1' : ''));
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  update(o: Order, status: string) {
    void this.shop.run(async () => {
      await api('orders/' + o.id, 'PATCH', { status });
      await this.load();
      this.cancel = null;
    }, 'Đã cập nhật đơn hàng.');
  }
}
