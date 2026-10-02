import { Component, Input, OnInit, inject } from '@angular/core';
import type { Member } from '../accounts/types';
import type { Order } from './types';
import { statusNames } from './types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';
import { EmptyComponent } from '../../shared/ui/empty.component';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-orders-view',
  standalone: true,
  imports: [EmptyComponent, LoaderComponent, ModalComponent, IconsComponent],
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
              <img [src]="o.items[0]?.image" alt="Sản phẩm trong đơn" />
              <div>
                <h3>{{ manage ? o.customer_name : o.items[0]?.name }}</h3>
                <p>
                  {{ itemQty(o) }} sản phẩm · {{ o.payment === 'cod' ? 'COD' : 'Chuyển khoản mẫu' }}
                </p>
                <strong>{{ money(o.total) }}</strong>
              </div>
            </div>
            <div class="order-card-actions">
              <button class="button small outline" (click)="selected = o">Chi tiết</button>
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
    @if (selected) {
      <app-modal [title]="'Đơn ' + selected.id" (close)="selected = null">
        <span [class]="'status ' + selected.status">{{ statusNames[selected.status] }}</span>
        <div class="order-stepper">
          @for (s of stages; track s; let i = $index) {
            <span [class.done]="selected.status !== 'cancelled' && stageIndex(selected.status) >= i"
              ><b>{{ i + 1 }}</b
              >{{ statusNames[s] }}</span
            >
          }
        </div>
        @for (i of selected.items; track $index) {
          <div class="order-detail-item">
            <img [src]="i.image" [alt]="i.name" />
            <div>
              <strong>{{ i.name }}</strong>
              <p>{{ i.color }} / {{ i.size }} × {{ i.quantity }}</p>
            </div>
            <strong>{{ money(i.price * i.quantity) }}</strong>
          </div>
        }
        <div class="summary-row"><span>Phí giao hàng</span>{{ money(selected.shipping) }}</div>
        <div class="summary-row"><span>Ưu đãi</span>−{{ money(selected.discount) }}</div>
        <div class="summary-total">
          <span>Tổng cộng</span><strong>{{ money(selected.total) }}</strong>
        </div>
        <h3>Người nhận</h3>
        <p>{{ selected.customer_name }} · {{ selected.phone }}<br />{{ selected.address }}</p>
        @if (selected.note) {
          <p>Ghi chú: {{ selected.note }}</p>
        }
        <div class="sample-callout">Đơn hàng mẫu, chưa thanh toán hoặc giao hàng thật.</div>
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
export class OrdersViewComponent implements OnInit {
  @Input({ required: true }) manage!: boolean;
  @Input({ required: true }) user!: Member;

  shop = inject(ShopService);
  money = money;
  statusNames = statusNames;

  orders: Order[] | null = null;
  filter = 'all';
  selected: Order | null = null;
  cancel: Order | null = null;

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
      this.selected = null;
      this.cancel = null;
    }, 'Đã cập nhật đơn hàng.');
  }
}
