import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { IssuedOffer, OfferConfig, OfferConfigInput, OfferHistoryRow, OfferKind } from './types';
import { offerKindNames } from './types';
import { ShopService } from '../../shop/shop.service';
import { dateTime, money } from '../../shared/formatters';
import { LoaderComponent } from '../../shared/ui/loader.component';

type Slot = { key: string; kind: OfferKind; milestone: number; label: string; rule: string };
type Row = Slot & { config: OfferConfig | null; form: OfferConfigInput };

const SLOTS: Slot[] = [
  {
    key: 'welcome:0',
    kind: 'welcome',
    milestone: 0,
    label: 'Chào mừng',
    rule: 'Cấp sau khi xác minh số điện thoại. Mỗi số điện thoại và mỗi tài khoản nhận một lần; hạn tính từ ngày tạo tài khoản.',
  },
  {
    key: 'birthday:0',
    kind: 'birthday',
    milestone: 0,
    label: 'Sinh nhật',
    rule: 'Tài khoản từ 30 ngày, ngày sinh cập nhật trước sinh nhật ≥ 30 ngày, có số điện thoại, có đơn đã giao và đã thanh toán. Mỗi số điện thoại một lần mỗi năm.',
  },
  { key: 'anniversary:1', kind: 'anniversary', milestone: 1, label: 'Kỷ niệm 1 năm', rule: 'Tự cấp khi tài khoản tròn 1 năm.' },
  { key: 'anniversary:2', kind: 'anniversary', milestone: 2, label: 'Kỷ niệm 2 năm', rule: 'Tự cấp khi tài khoản tròn 2 năm.' },
  { key: 'anniversary:3', kind: 'anniversary', milestone: 3, label: 'Kỷ niệm 3 năm trở lên', rule: 'Áp dụng cho mốc 3 năm và các năm sau.' },
];
const DEFAULTS: OfferConfigInput = { percent: 10, max_discount: 100000, minimum: 0, valid_days: 30, active: 1 };

@Component({
  selector: 'app-offer-config',
  standalone: true,
  imports: [FormsModule, LoaderComponent],
  template: `@if (!rows) {
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      } @else {
        <app-loader />
      }
    } @else {
      <div class="admin-panel">
        <h2>Cấu hình ưu đãi thành viên</h2>
        <p class="muted">
          Ba loại ưu đãi tự động cấp cho khách hàng. Mỗi đơn chỉ dùng một mã và không cộng dồn với coupon thường.
          @if (!canEdit) {
            Bạn có quyền xem; chỉ chủ shop chỉnh sửa được cấu hình.
          } @else {
            Mọi thay đổi được lưu vào lịch sử. "Tắt" chỉ ngừng cấp mã mới, mã đã cấp vẫn giữ nguyên.
          }
        </p>
        <div class="offer-config-list">
          @for (r of rows; track r.key) {
            <form class="offer-config" (submit)="save($event, r)">
              <div class="offer-config-head">
                <div>
                  <strong>{{ r.label }}</strong>
                  <span class="muted">{{ kindName(r.kind) }}</span>
                </div>
                @if (r.config) {
                  <span [class]="'pill' + (r.config.active ? '' : ' muted')">{{ r.config.active ? 'Đang bật' : 'Đã tắt' }}</span>
                } @else {
                  <span class="pill muted">Chưa cấu hình</span>
                }
              </div>
              <p class="muted offer-rule">{{ r.rule }}</p>
              <div class="offer-config-fields">
                <label
                  >Giảm (%)<input type="number" min="1" max="50" required [disabled]="!canEdit" [(ngModel)]="r.form.percent" [name]="r.key + 'p'"
                /></label>
                <label
                  >Giảm tối đa (đ)<input type="number" min="0" max="10000000" required [disabled]="!canEdit" [(ngModel)]="r.form.max_discount" [name]="r.key + 'm'"
                /></label>
                <label
                  >Đơn tối thiểu (đ)<input type="number" min="0" max="100000000" required [disabled]="!canEdit" [(ngModel)]="r.form.minimum" [name]="r.key + 'n'"
                /></label>
                <label
                  >Hạn dùng (ngày)<input type="number" min="1" max="365" required [disabled]="!canEdit" [(ngModel)]="r.form.valid_days" [name]="r.key + 'd'"
                /></label>
              </div>
              @if (canEdit) {
                <div class="offer-config-actions">
                  <label class="check-label"
                    ><input
                      type="checkbox"
                      [checked]="!!r.form.active"
                      (change)="r.form.active = $any($event.target).checked ? 1 : 0"
                      [name]="r.key + 'a'"
                    />Bật cấp ưu đãi này</label
                  >
                  <button class="button black small" type="submit" [disabled]="shop.busy">
                    {{ r.config ? 'Lưu cấu hình' : 'Tạo cấu hình' }}
                  </button>
                  @if (r.config && r.config.active) {
                    <button class="text-button danger" type="button" [disabled]="shop.busy" (click)="disable(r)">Tắt cấu hình</button>
                  }
                </div>
              }
            </form>
          }
        </div>
      </div>

      <div class="admin-panel table-scroll">
        <h2>Mã đã cấp gần đây</h2>
        <table>
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Loại</th>
              <th>Mã</th>
              <th>Ưu đãi</th>
              <th>Hạn dùng</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            @for (o of issued; track o.id) {
              <tr>
                <td>
                  <strong>{{ o.member_name || '—' }}</strong
                  ><small class="block">{{ o.email }}</small>
                </td>
                <td>{{ kindName(o.kind) }}{{ o.kind === 'anniversary' && o.milestone ? ' ' + o.milestone + ' năm' : '' }}</td>
                <td>
                  <code>{{ o.code }}</code>
                </td>
                <td>{{ o.percent }}% · tối đa {{ money(o.max_discount) }}</td>
                <td>{{ date(o.expires_at) }}</td>
                <td>{{ statusLabel[o.status] }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="muted">Chưa cấp mã nào.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="admin-panel table-scroll">
        <h2>Lịch sử thay đổi cấu hình</h2>
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người sửa</th>
              <th>Hành động</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            @for (h of history; track h.id) {
              <tr>
                <td>{{ date(h.created_at) }}</td>
                <td>{{ h.actor_name || '—' }}</td>
                <td>{{ actionLabel[h.snapshot.action] || h.snapshot.action }}</td>
                <td>{{ summary(h) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="muted">Chưa có thay đổi nào.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class OfferConfigComponent implements OnInit {
  shop = inject(ShopService);
  money = money;
  date = dateTime;
  rows: Row[] | null = null;
  issued: IssuedOffer[] = [];
  history: OfferHistoryRow[] = [];
  error = '';
  statusLabel: Record<string, string> = { active: 'Dùng được', upcoming: 'Chưa đến hạn', used: 'Đã dùng', expired: 'Hết hạn' };
  actionLabel: Record<string, string> = { create: 'Tạo cấu hình', update: 'Cập nhật', disable: 'Tắt cấu hình' };

  get canEdit() {
    return this.shop.session.user?.role === 'admin';
  }

  kindName(kind: string) {
    return offerKindNames[kind as OfferKind] || kind;
  }

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      const [configs, issued, history] = await Promise.all([
        this.shop.getOfferConfigs(),
        this.shop.getIssuedOffers(),
        this.shop.getOfferHistory(),
      ]);
      this.issued = issued;
      this.history = history;
      this.rows = SLOTS.map((slot) => {
        const config = configs.find((c) => c.kind === slot.kind && c.milestone === slot.milestone) || null;
        const form: OfferConfigInput = config
          ? {
              percent: config.percent,
              max_discount: config.max_discount,
              minimum: config.minimum,
              valid_days: config.valid_days,
              active: config.active,
            }
          : { ...DEFAULTS };
        return { ...slot, config, form };
      });
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  save(e: Event, r: Row) {
    e.preventDefault();
    const values: OfferConfigInput = {
      percent: Number(r.form.percent),
      max_discount: Number(r.form.max_discount),
      minimum: Number(r.form.minimum),
      valid_days: Number(r.form.valid_days),
      active: r.form.active ? 1 : 0,
    };
    void this.shop.run(async () => {
      if (r.config) await this.shop.updateOfferConfig(r.config.id, values);
      else await this.shop.createOfferConfig(r.kind, r.milestone, values);
      await this.load();
    }, 'Đã lưu cấu hình ưu đãi.');
  }

  disable(r: Row) {
    if (!r.config) return;
    const id = r.config.id;
    void this.shop.run(async () => {
      await this.shop.disableOfferConfig(id);
      await this.load();
    }, 'Đã tắt cấu hình ưu đãi.');
  }

  summary(h: OfferHistoryRow) {
    const after = h.snapshot.after || h.snapshot.before;
    if (!after) return '';
    const kind = after.kind ? this.kindName(after.kind) + (after.milestone ? ' ' + after.milestone + ' năm' : '') + ': ' : '';
    return `${kind}${after.percent}% · tối đa ${money(after.max_discount ?? 0)} · tối thiểu ${money(after.minimum ?? 0)} · ${after.valid_days} ngày`;
  }
}
