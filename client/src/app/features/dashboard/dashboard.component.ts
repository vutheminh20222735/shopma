import { Component, OnInit, inject } from '@angular/core';
import type { Order } from '../orders/types';
import { statusNames } from '../orders/types';
import { api } from '../../shared/api';
import { money } from '../../shared/formatters';
import { ShopService } from '../../shop/shop.service';
import { LoaderComponent } from '../../shared/ui/loader.component';
import { IconsComponent } from '../../shared/icons.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [LoaderComponent, IconsComponent],
  template: `@if (!data) {
      <app-loader />
    } @else {
      <div class="stat-grid">
        @for (s of stats; track s.label) {
          <div class="stat-card">
            <span>{{ s.label }}<app-icon [name]="s.icon" [size]="20" /></span>
            <strong>{{ s.value }}</strong>
          </div>
        }
      </div>
      <div class="dashboard-grid">
        <div class="admin-panel">
          <h2>Tình trạng đơn hàng</h2>
          @if (data.totalOrders) {
            <div class="status-bars">
              @for (s of stages; track s) {
                <div>
                  <span>{{ statusNames[s] }}</span>
                  <div><b [style.width.%]="barWidth(s)"></b></div>
                  <strong>{{ countStatus(s) }}</strong>
                </div>
              }
            </div>
          } @else {
            <div class="dashboard-empty">
              <app-icon name="package" [size]="32" />
              <p>Đặt một đơn mẫu từ cửa hàng để bắt đầu theo dõi.</p>
              <button class="button outline small" (click)="shop.go('/san-pham')">Mở bộ sưu tập</button>
            </div>
          }
        </div>
        <div class="admin-panel quick-work">
          <h2>Việc cần làm</h2>
          <button (click)="shop.go('/quan-tri/don-hang')">
            <app-icon name="package-check" [size]="22" />
            <div>
              <strong>{{ data.pending }} đơn chờ xác nhận</strong><span>Kiểm tra và chuẩn bị đơn mới</span>
            </div>
          </button>
          <button (click)="shop.go('/quan-tri/kho-hang')">
            <app-icon name="boxes" [size]="22" />
            <div>
              <strong>{{ data.lowStock }} biến thể sắp hết</strong><span>Kiểm tra tồn kho theo size và màu</span>
            </div>
          </button>
        </div>
      </div>
      <div class="admin-panel">
        <div class="section-heading">
          <h2>Đơn gần đây</h2>
          <button class="text-button" (click)="shop.go('/quan-tri/don-hang')">
            Xem tất cả <app-icon name="plus" [size]="16" />
          </button>
        </div>
        @if (data.orders.length) {
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Giá trị</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                @for (o of recentOrders; track o.id) {
                  <tr>
                    <td>{{ o.id }}</td>
                    <td>{{ o.customer_name }}</td>
                    <td>{{ money(o.total) }}</td>
                    <td><span [class]="'status ' + o.status">{{ statusNames[o.status] }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">Chưa có đơn hàng. Số liệu được cập nhật từ đơn bạn tạo.</p>
        }
      </div>
    }`,
})
export class DashboardComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  statusNames = statusNames;

  data: any = null;
  stages = ['pending', 'confirmed', 'packing', 'shipping', 'delivered'];

  get stats() {
    if (!this.data) return [];
    return [
      { label: 'Doanh thu đã giao', value: money(this.data.revenue), icon: 'shopping-bag' },
      { label: 'Tổng đơn hàng', value: this.data.totalOrders, icon: 'package' },
      { label: 'Chờ xác nhận', value: this.data.pending, icon: 'shopping-basket' },
      { label: 'Biến thể sắp hết', value: this.data.lowStock, icon: 'boxes' },
    ];
  }

  get recentOrders() {
    return (this.data?.orders as Order[] | undefined)?.slice(0, 5) ?? [];
  }

  ngOnInit() {
    api('dashboard')
      .then((d) => (this.data = d))
      .catch((e) => this.shop.notify(e.message, true));
  }

  countStatus(s: string) {
    return this.data.orders.filter((o: Order) => o.status === s).length;
  }

  barWidth(s: string) {
    const max = Math.max(1, ...this.stages.map((st) => this.countStatus(st)));
    return (this.countStatus(s) / max) * 100;
  }
}
