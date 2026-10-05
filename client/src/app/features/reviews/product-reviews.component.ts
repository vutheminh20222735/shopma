import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Review, ReviewPage } from './types';
import { ShopService } from '../../shop/shop.service';
import { dateTime } from '../../shared/formatters';
import { IconsComponent } from '../../shared/icons.component';
import { StarsComponent } from '../../shared/ui/stars.component';
import { HideReasonModalComponent } from './hide-reason-modal.component';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [FormsModule, IconsComponent, StarsComponent, HideReasonModalComponent],
  template: `<section class="reviews" id="danh-gia" aria-labelledby="reviews-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">ĐÁNH GIÁ</p>
        <h2 id="reviews-title">Đánh giá từ khách hàng</h2>
      </div>
      @if (isTeam) {
        <label class="check-label"
          ><input type="checkbox" [(ngModel)]="showHidden" name="showHidden" (ngModelChange)="reload()" />Hiện cả đánh giá
          đã ẩn</label
        >
      }
    </div>

    @if (data) {
      <div class="review-summary">
        <div class="review-score">
          <strong>{{ data.count ? data.average.toFixed(1) : '—' }}</strong>
          <app-stars [value]="data.average" [size]="20" />
          <span class="muted">{{ data.count }} đánh giá</span>
        </div>
        <div class="review-bars" role="group" aria-label="Lọc theo số sao">
          @for (s of starList; track s) {
            <button
              type="button"
              [class.active]="stars === s"
              [attr.aria-pressed]="stars === s"
              [disabled]="!data.distribution[s]"
              (click)="filterStars(s)"
            >
              <span>{{ s }} sao</span>
              <i><b [style.width.%]="percent(s)"></b></i>
              <em>{{ data.distribution[s] || 0 }}</em>
            </button>
          }
        </div>
      </div>

      <div class="category-tabs review-tabs">
        <button [class.active]="stars === 0" (click)="filterStars(0)">Tất cả ({{ data.count }})</button>
        @for (s of starList; track s) {
          <button [class.active]="stars === s" [disabled]="!data.distribution[s]" (click)="filterStars(s)">
            {{ s }} sao ({{ data.distribution[s] || 0 }})
          </button>
        }
      </div>

      <!-- Viết / sửa đánh giá -->
      @if (!shop.session.user) {
        <div class="review-note">
          <span>Đăng nhập bằng tài khoản khách hàng đã mua sản phẩm để viết đánh giá.</span>
          <button class="text-button" (click)="shop.go('/tai-khoan')">Đăng nhập</button>
        </div>
      } @else if (isCustomer) {
        @if (draftOpen) {
          <form class="review-form" (submit)="submit($event)">
            <h3>{{ editing ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá' }}</h3>
            <div class="star-picker" role="radiogroup" aria-label="Chấm điểm">
              @for (i of starValues; track i) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="draft.rating === i"
                  [attr.aria-label]="i + ' sao'"
                  [class.on]="i <= draft.rating"
                  (click)="draft.rating = i"
                >
                  <app-icon name="star" [size]="28" [strokeWidth]="1.5" [fill]="i <= draft.rating ? 'currentColor' : 'none'" />
                </button>
              }
              <span class="muted">{{ draft.rating ? ratingText[draft.rating] : 'Chọn số sao' }}</span>
            </div>
            <label
              >Nhận xét (từ 10 ký tự)
              <textarea
                required
                minlength="10"
                maxlength="1000"
                [(ngModel)]="draft.content"
                name="content"
                placeholder="Chất liệu, form dáng, độ vừa vặn…"
              ></textarea>
            </label>
            @if (formError) {
              <p class="form-error" role="alert">{{ formError }}</p>
            }
            <div class="review-form-actions">
              <button class="button black" type="submit" [disabled]="saving">
                {{ saving ? 'Đang gửi…' : editing ? 'Lưu thay đổi' : 'Gửi đánh giá' }}
              </button>
              <button class="button outline" type="button" (click)="cancelDraft()">Hủy</button>
            </div>
          </form>
        } @else if (data.can_review) {
          <div class="review-note">
            <span><app-icon name="badge-check" [size]="18" />Bạn đã nhận sản phẩm này. Chia sẻ trải nghiệm để giúp khách khác chọn đúng size.</span>
            <button class="button black small" (click)="openCreate()">Viết đánh giá</button>
          </div>
        } @else if (data.my_review_id) {
          <div class="review-note">
            <span><app-icon name="badge-check" [size]="18" />Bạn đã đánh giá sản phẩm này.</span>
            <button class="button outline small" (click)="startEdit()" [disabled]="saving">Sửa đánh giá của tôi</button>
          </div>
          @if (formError) {
            <p class="form-error" role="alert">{{ formError }}</p>
          }
        } @else {
          <div class="review-note">
            <span
              >Chỉ khách có đơn hàng chứa sản phẩm này đã giao và đã thanh toán mới viết được đánh giá. Mỗi sản phẩm đánh
              giá một lần và có thể chỉnh sửa sau đó.</span
            >
          </div>
        }
      }

      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }

      <div class="review-list" [class.loading-state]="loading" aria-live="polite">
        @for (r of data.items; track r.id) {
          <article [class]="'review-item' + (r.hidden ? ' is-hidden' : '')">
            <div class="review-head">
              <app-stars [value]="r.rating" [size]="15" />
              @if (r.verified_purchase) {
                <span class="verified-badge"><app-icon name="badge-check" [size]="14" />{{ r.verified_label || 'Đã mua hàng' }}</span>
              }
              @if (r.mine) {
                <span class="pill">Đánh giá của bạn</span>
              }
            </div>
            <p class="review-meta">
              <strong>{{ r.author }}</strong> · {{ date(r.created_at) }}
              @if (r.updated_at && r.updated_at !== r.created_at) {
                <span class="muted"> · đã chỉnh sửa {{ date(r.updated_at) }}</span>
              }
            </p>
            @if (r.hidden) {
              <p class="hidden-flag"><app-icon name="eye-off" [size]="14" />Đã ẩn{{ r.hidden_reason ? ': ' + r.hidden_reason : '' }}</p>
            }
            <p class="review-content">{{ r.content }}</p>
            @if (isManagement) {
              <div class="review-actions">
                @if (r.hidden) {
                  <button class="text-button" [disabled]="saving" (click)="unhide(r)">Hiện lại đánh giá</button>
                } @else {
                  <button class="text-button danger" (click)="hiding = r">Ẩn đánh giá</button>
                }
              </div>
            }
          </article>
        } @empty {
          <p class="muted review-empty">
            {{ stars ? 'Chưa có đánh giá ' + stars + ' sao.' : 'Chưa có đánh giá nào cho sản phẩm này.' }}
          </p>
        }
      </div>

      @if (data.pages > 1) {
        <nav class="pager" aria-label="Phân trang đánh giá">
          <button class="icon-button" aria-label="Trang trước" [disabled]="page <= 1 || loading" (click)="goPage(page - 1)">
            <app-icon name="chevron-left" [size]="18" />
          </button>
          @for (p of pageList; track p) {
            <button [class.active]="p === page" [attr.aria-current]="p === page ? 'page' : null" (click)="goPage(p)">
              {{ p }}
            </button>
          }
          <button
            class="icon-button"
            aria-label="Trang sau"
            [disabled]="page >= data.pages || loading"
            (click)="goPage(page + 1)"
          >
            <app-icon name="chevron-right" [size]="18" />
          </button>
        </nav>
      }
    } @else if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    } @else {
      <div class="loading" role="status"><span class="spinner"></span>Đang tải đánh giá…</div>
    }

    @if (hiding) {
      <app-hide-reason-modal
        title="Ẩn đánh giá"
        [busy]="saving"
        [error]="hideError"
        (close)="hiding = null; hideError = ''"
        (confirm)="hide($event)"
      />
    }
  </section>`,
})
export class ProductReviewsComponent implements OnChanges, OnInit {
  shop = inject(ShopService);
  @Input({ required: true }) productId!: string;

  data: ReviewPage | null = null;
  stars = 0;
  page = 1;
  loading = false;
  error = '';
  showHidden = false;

  starList = [5, 4, 3, 2, 1];
  starValues = [1, 2, 3, 4, 5];
  ratingText = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];
  date = dateTime;

  draftOpen = false;
  editing: Review | null = null;
  draft = { rating: 0, content: '' };
  formError = '';
  saving = false;

  hiding: Review | null = null;
  hideError = '';

  get isCustomer() {
    return this.shop.session.user?.role === 'customer';
  }

  get isTeam() {
    return this.shop.isTeam;
  }

  get isManagement() {
    return this.shop.isManagement;
  }

  get pageList() {
    const pages = this.data?.pages || 1;
    const start = Math.max(1, Math.min(this.page - 2, pages - 4));
    const end = Math.min(pages, start + 4);
    const list: number[] = [];
    for (let p = start; p <= end; p++) list.push(p);
    return list;
  }

  ngOnInit() {
    if (this.productId) void this.load();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['productId'] && !changes['productId'].firstChange) {
      this.stars = 0;
      this.page = 1;
      this.data = null;
      this.cancelDraft();
      void this.load();
    }
  }

  percent(star: number) {
    if (!this.data?.count) return 0;
    return Math.round(((this.data.distribution[star] || 0) / this.data.count) * 100);
  }

  filterStars(s: number) {
    this.stars = this.stars === s ? 0 : s;
    this.page = 1;
    void this.load();
  }

  goPage(p: number) {
    this.page = p;
    void this.load();
    document.getElementById('danh-gia')?.scrollIntoView({ block: 'start' });
  }

  reload() {
    this.page = 1;
    void this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.data = await this.shop.getReviews(this.productId, {
        stars: this.stars,
        page: this.page,
        includeHidden: this.isTeam && this.showHidden,
      });
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  openCreate() {
    this.editing = null;
    this.draft = { rating: 0, content: '' };
    this.formError = '';
    this.draftOpen = true;
  }

  async startEdit() {
    this.formError = '';
    this.saving = true;
    try {
      let mine = this.data?.items.find((r) => r.mine) || null;
      if (!mine) mine = await this.findMine();
      if (!mine) {
        this.formError =
          'Không tìm thấy nội dung đánh giá của bạn. Đánh giá có thể đang bị cửa hàng ẩn nên chưa thể chỉnh sửa.';
        return;
      }
      this.editing = mine;
      this.draft = { rating: mine.rating, content: mine.content };
      this.draftOpen = true;
    } catch (e) {
      this.formError = (e as Error).message;
    } finally {
      this.saving = false;
    }
  }

  /** Đánh giá của tôi có thể nằm ở trang khác: tìm lần lượt (tối đa 20 trang). */
  private async findMine() {
    const pages = Math.min(this.data?.pages || 1, 20);
    for (let p = 1; p <= pages; p++) {
      const res = await this.shop.getReviews(this.productId, { page: p });
      const mine = res.items.find((r) => r.mine);
      if (mine) return mine;
    }
    return null;
  }

  cancelDraft() {
    this.draftOpen = false;
    this.editing = null;
    this.formError = '';
  }

  async submit(e: Event) {
    e.preventDefault();
    this.formError = '';
    if (this.draft.rating < 1) {
      this.formError = 'Vui lòng chọn số sao.';
      return;
    }
    this.saving = true;
    try {
      const content = this.draft.content.trim();
      if (this.editing) await this.shop.updateReview(this.editing.id, this.draft.rating, content);
      else await this.shop.createReview(this.productId, this.draft.rating, content);
      this.shop.notify(this.editing ? 'Đã cập nhật đánh giá.' : 'Cảm ơn bạn đã đánh giá sản phẩm.');
      this.cancelDraft();
      this.page = 1;
      await this.load();
    } catch (err) {
      // Hiển thị đúng lý do từ API (chưa đủ điều kiện, đã đánh giá, bị ẩn…).
      this.formError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async hide(reason: string) {
    if (!this.hiding) return;
    this.saving = true;
    this.hideError = '';
    try {
      await this.shop.moderateReview(this.hiding.id, reason);
      this.shop.notify('Đã ẩn đánh giá.');
      this.hiding = null;
      await this.load();
    } catch (e) {
      this.hideError = (e as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async unhide(r: Review) {
    this.saving = true;
    try {
      await this.shop.moderateReview(r.id, null);
      this.shop.notify('Đã hiện lại đánh giá.');
      await this.load();
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    } finally {
      this.saving = false;
    }
  }
}
