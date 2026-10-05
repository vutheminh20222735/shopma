import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ReportPeriod, RevenueBucket, RevenueReport } from './types';
import { ShopService } from '../../shop/shop.service';
import { money, todayVn, ymdLabel } from '../../shared/formatters';
import { IconsComponent } from '../../shared/icons.component';
import { LoaderComponent } from '../../shared/ui/loader.component';

@Component({
  selector: 'app-revenue-report',
  standalone: true,
  imports: [FormsModule, IconsComponent, LoaderComponent],
  template: `<div class="admin-panel report-controls">
      <div class="category-tabs order-tabs" role="tablist" aria-label="Kỳ báo cáo">
        @for (p of periods; track p.id) {
          <button role="tab" [attr.aria-selected]="period === p.id" [class.active]="period === p.id" (click)="setPeriod(p.id)">
            {{ p.label }}
          </button>
        }
      </div>
      <form class="report-form" (submit)="$event.preventDefault(); load()">
        @if (period === 'custom') {
          <label
            >Từ ngày<input type="date" required [max]="to || today" [(ngModel)]="from" name="from"
          /></label>
          <label
            >Đến ngày<input type="date" required [min]="from" [max]="today" [(ngModel)]="to" name="to"
          /></label>
        } @else {
          <p class="muted">{{ hint }}</p>
        }
        <button class="button black small" type="submit" [disabled]="loading">
          <app-icon name="refresh-cw" [size]="15" />{{ loading ? 'Đang tải…' : 'Xem báo cáo' }}
        </button>
        <button class="button outline small" type="button" [disabled]="!report || exporting" (click)="exportCsv()">
          <app-icon name="download" [size]="15" />{{ exporting ? 'Đang xuất…' : 'Tải CSV' }}
        </button>
      </form>
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }
    </div>

    @if (!report) {
      @if (!error) {
        <app-loader />
      }
    } @else {
      <p class="muted report-definition">
        {{ report.definition }} Khoảng {{ ymd(report.from) }} – {{ ymd(report.to) }} (múi giờ {{ report.timezone }}).
      </p>
      <div class="stat-grid">
        <div class="stat-card">
          <span>Số đơn tính doanh thu<app-icon name="package-check" [size]="20" /></span>
          <strong>{{ report.totals.orders }}</strong>
        </div>
        <div class="stat-card">
          <span>Tiền hàng sau giảm giá<app-icon name="shopping-bag" [size]="20" /></span>
          <strong>{{ money(report.totals.net_goods) }}</strong>
        </div>
        <div class="stat-card">
          <span>Phí vận chuyển (tách riêng)<app-icon name="truck" [size]="20" /></span>
          <strong>{{ money(report.totals.shipping) }}</strong>
        </div>
        <div class="stat-card">
          <span>Tổng thu (hàng + vận chuyển)<app-icon name="bar-chart" [size]="20" /></span>
          <strong>{{ money(report.totals.total) }}</strong>
        </div>
        <div class="stat-card">
          <span>Hoàn tiền đã xác nhận<app-icon name="refresh-cw" [size]="20" /></span>
          <strong>{{ money(report.totals.refunds) }}</strong>
          @if (report.totals.pending_refunds) {
            <small class="muted">Đang chờ hoàn: {{ money(report.totals.pending_refunds) }}</small>
          }
        </div>
        <div class="stat-card">
          <span>Thu sau hoàn tiền<app-icon name="tag" [size]="20" /></span>
          <strong>{{ money(report.totals.net_after_refunds) }}</strong>
        </div>
      </div>

      @if (!report.profit_available) {
        <p class="unavailable-note report-note">
          <app-icon name="clock" [size]="15" />Hệ thống chưa lưu giá vốn nên báo cáo này chỉ có doanh thu, không tính lợi nhuận.
        </p>
      }

      <div class="admin-panel">
        <div class="section-heading">
          <h2>Tổng thu theo {{ granularityLabel }}</h2>
          <div class="chart-legend">
            <span><i class="goods"></i>Tiền hàng sau giảm</span>
            <span><i class="ship"></i>Phí vận chuyển</span>
          </div>
        </div>
        @if (hasRevenue) {
          <div class="chart" role="img" [attr.aria-label]="'Biểu đồ tổng thu theo ' + granularityLabel">
            <div class="chart-axis">
              <span>{{ money(max) }}</span>
              <span>{{ money(max / 2) }}</span>
              <span>0</span>
            </div>
            <div class="chart-bars">
              @for (b of report.data; track b.period; let i = $index) {
                <div class="chart-col" [title]="tooltip(b)">
                  <div class="chart-stack">
                    <i class="ship" [style.height.%]="pct(b.shipping)"></i>
                    <i class="goods" [style.height.%]="pct(b.net_goods)"></i>
                  </div>
                  <span class="chart-label">{{ showLabel(i) ? label(b.period) : '' }}</span>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="dashboard-empty">
            <app-icon name="bar-chart" [size]="32" />
            <p>Chưa có đơn đã giao và đã thanh toán trong khoảng thời gian này.</p>
          </div>
        }
      </div>

      <div class="admin-panel table-scroll">
        <h2>Chi tiết theo {{ granularityLabel }}</h2>
        <table>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Số đơn</th>
              <th>Tiền hàng</th>
              <th>Giảm giá</th>
              <th>Hàng sau giảm</th>
              <th>Phí vận chuyển</th>
              <th>Tổng thu</th>
              <th>Hoàn tiền</th>
              <th>Hoàn đang chờ</th>
              <th>Thu sau hoàn</th>
            </tr>
          </thead>
          <tbody>
            @for (b of rows; track b.period) {
              <tr>
                <td>
                  <strong>{{ label(b.period, true) }}</strong>
                </td>
                <td>{{ b.orders }}</td>
                <td>{{ money(b.goods) }}</td>
                <td>{{ b.discount ? '−' + money(b.discount) : money(0) }}</td>
                <td>{{ money(b.net_goods) }}</td>
                <td>{{ money(b.shipping) }}</td>
                <td>{{ money(b.total) }}</td>
                <td>{{ money(b.refunds) }}</td>
                <td>{{ money(b.pending_refunds) }}</td>
                <td>{{ money(b.net_after_refunds) }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="table-total">
              <td><strong>Tổng cộng</strong></td>
              <td>{{ report.totals.orders }}</td>
              <td>{{ money(report.totals.goods) }}</td>
              <td>{{ report.totals.discount ? '−' + money(report.totals.discount) : money(0) }}</td>
              <td>{{ money(report.totals.net_goods) }}</td>
              <td>{{ money(report.totals.shipping) }}</td>
              <td>{{ money(report.totals.total) }}</td>
              <td>{{ money(report.totals.refunds) }}</td>
              <td>{{ money(report.totals.pending_refunds) }}</td>
              <td>{{ money(report.totals.net_after_refunds) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    }`,
})
export class RevenueReportComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  ymd = ymdLabel;
  today = todayVn();

  periods: { id: ReportPeriod; label: string }[] = [
    { id: 'day', label: 'Theo ngày' },
    { id: 'month', label: 'Theo tháng' },
    { id: 'year', label: 'Theo năm' },
    { id: 'custom', label: 'Tùy chọn' },
  ];
  period: ReportPeriod = 'day';
  from = todayVn(-29);
  to = todayVn();

  report: RevenueReport | null = null;
  loading = false;
  exporting = false;
  error = '';

  get hint() {
    return this.period === 'day' ? '30 ngày gần nhất' : this.period === 'month' ? '12 tháng gần nhất' : '5 năm gần nhất';
  }

  get granularityLabel() {
    const g = this.report?.granularity;
    return g === 'month' ? 'tháng' : g === 'year' ? 'năm' : 'ngày';
  }

  get rows(): RevenueBucket[] {
    return this.report ? [...this.report.data].reverse() : [];
  }

  /** Giá trị lớn nhất để quy đổi chiều cao cột (làm tròn lên cho trục dễ đọc). */
  get max() {
    const peak = Math.max(0, ...(this.report?.data.map((b) => b.total) || []));
    if (peak <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(peak));
    return Math.ceil(peak / magnitude) * magnitude;
  }

  get hasRevenue() {
    return !!this.report?.data.some((b) => b.total > 0);
  }

  ngOnInit() {
    void this.load();
  }

  setPeriod(p: ReportPeriod) {
    this.period = p;
    void this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.report = await this.shop.getRevenueReport({ period: this.period, from: this.from, to: this.to });
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async exportCsv() {
    this.exporting = true;
    try {
      await this.shop.downloadRevenueCsv({ period: this.period, from: this.from, to: this.to });
      this.shop.notify('Đã tải tệp CSV.');
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    } finally {
      this.exporting = false;
    }
  }

  pct(value: number) {
    return Math.max(0, Math.min(100, (value / this.max) * 100));
  }

  /** Thưa bớt nhãn trục ngang khi có nhiều cột. */
  showLabel(index: number) {
    const n = this.report?.data.length || 0;
    const step = n > 60 ? 10 : n > 31 ? 5 : n > 16 ? 2 : 1;
    return index % step === 0;
  }

  label(period: string, full = false) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return full ? ymdLabel(period) : `${period.slice(8)}/${period.slice(5, 7)}`;
    if (/^\d{4}-\d{2}$/.test(period)) return `${period.slice(5)}/${period.slice(0, 4)}`;
    return period;
  }

  tooltip(b: RevenueBucket) {
    return `${this.label(b.period, true)}: ${b.orders} đơn · hàng ${money(b.net_goods)} · vận chuyển ${money(b.shipping)} · tổng thu ${money(b.total)}`;
  }
}
