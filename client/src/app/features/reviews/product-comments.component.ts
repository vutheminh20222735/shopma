import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import type { CommentList, ProductComment } from './types';
import { ShopService } from '../../shop/shop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateTime } from '../../shared/formatters';
import { IconsComponent } from '../../shared/icons.component';
import { HideReasonModalComponent } from './hide-reason-modal.component';

@Component({
  selector: 'app-product-comments',
  standalone: true,
  imports: [FormsModule, IconsComponent, HideReasonModalComponent],
  template: `<section class="comments" id="hoi-dap" aria-labelledby="comments-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">HỎI ĐÁP</p>
        <h2 id="comments-title">Bình luận & hỏi đáp @if (data) {<span class="heading-count">({{ data.count }})</span>}</h2>
      </div>
      @if (shop.isTeam) {
        <label class="check-label"
          ><input type="checkbox" [(ngModel)]="showHidden" name="showHiddenComments" (ngModelChange)="load()" />Hiện cả bình
          luận đã ẩn</label
        >
      }
    </div>

    @if (!shop.session.user) {
      <div class="review-note">
        <span>Đăng nhập để đặt câu hỏi hoặc bình luận về sản phẩm.</span>
        <button class="text-button" (click)="shop.go('/tai-khoan')">Đăng nhập</button>
      </div>
    } @else {
      <form class="review-form" (submit)="submitRoot($event)">
        <label
          >{{ shop.isTeam ? 'Phản hồi với tư cách cửa hàng' : 'Câu hỏi hoặc bình luận của bạn' }}
          <textarea
            required
            minlength="5"
            maxlength="1000"
            [(ngModel)]="content"
            name="content"
            placeholder="Ví dụ: Sản phẩm này có hợp với người cao 1m65 không?"
          ></textarea>
        </label>
        @if (formError) {
          <p class="form-error" role="alert">{{ formError }}</p>
        }
        <div class="review-form-actions">
          <button class="button black" type="submit" [disabled]="saving">{{ saving && !replyTo ? 'Đang gửi…' : 'Gửi' }}</button>
        </div>
      </form>
    }

    @if (error) {
      <p class="form-error" role="alert">{{ error }}</p>
    }
    @if (data) {
      <div class="comment-list">
        @for (c of data.items; track c.id) {
          <article [class]="'comment' + (c.hidden ? ' is-hidden' : '')">
            <div class="comment-head">
              <strong>{{ c.author }}</strong>
              @if (c.is_staff_reply) {
                <span class="staff-badge">Phản hồi từ shop</span>
              }
              <span class="muted">{{ date(c.created_at) }}</span>
            </div>
            @if (c.hidden) {
              <p class="hidden-flag"><app-icon name="eye-off" [size]="14" />Đã ẩn{{ c.hidden_reason ? ': ' + c.hidden_reason : '' }}</p>
            }
            <p class="comment-body">{{ c.content }}</p>
            <div class="review-actions">
              @if (shop.session.user) {
                <button class="text-button" (click)="toggleReply(c.id)">Trả lời</button>
              }
              @if (shop.isManagement) {
                @if (c.hidden) {
                  <button class="text-button" [disabled]="saving" (click)="unhide(c)">Hiện lại</button>
                } @else {
                  <button class="text-button danger" (click)="hiding = c">Ẩn</button>
                }
              }
            </div>
            @if (c.replies?.length) {
              <div class="comment-replies">
                @for (r of c.replies; track r.id) {
                  <div [class]="'comment reply' + (r.is_staff_reply ? ' staff' : '') + (r.hidden ? ' is-hidden' : '')">
                    <div class="comment-head">
                      <strong>{{ r.author }}</strong>
                      @if (r.is_staff_reply) {
                        <span class="staff-badge">Phản hồi từ shop</span>
                      }
                      <span class="muted">{{ date(r.created_at) }}</span>
                    </div>
                    @if (r.hidden) {
                      <p class="hidden-flag"><app-icon name="eye-off" [size]="14" />Đã ẩn{{ r.hidden_reason ? ': ' + r.hidden_reason : '' }}</p>
                    }
                    <p class="comment-body">{{ r.content }}</p>
                    @if (shop.isManagement) {
                      <div class="review-actions">
                        @if (r.hidden) {
                          <button class="text-button" [disabled]="saving" (click)="unhide(r)">Hiện lại</button>
                        } @else {
                          <button class="text-button danger" (click)="hiding = r">Ẩn</button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
            @if (replyTo === c.id) {
              <form class="reply-form" (submit)="submitReply($event, c)">
                <textarea
                  required
                  minlength="5"
                  maxlength="1000"
                  aria-label="Nội dung trả lời"
                  [(ngModel)]="replyText"
                  name="replyText"
                  placeholder="Nhập nội dung trả lời…"
                ></textarea>
                @if (replyError) {
                  <p class="form-error" role="alert">{{ replyError }}</p>
                }
                <div class="review-form-actions">
                  <button class="button black small" type="submit" [disabled]="saving">
                    {{ saving ? 'Đang gửi…' : 'Gửi trả lời' }}
                  </button>
                  <button class="button outline small" type="button" (click)="replyTo = null">Hủy</button>
                </div>
              </form>
            }
          </article>
        } @empty {
          <p class="muted review-empty">Chưa có câu hỏi nào. Hãy là người đầu tiên đặt câu hỏi cho shop.</p>
        }
      </div>
    } @else if (!error) {
      <div class="loading" role="status"><span class="spinner"></span>Đang tải bình luận…</div>
    }

    @if (hiding) {
      <app-hide-reason-modal
        title="Ẩn bình luận"
        [busy]="saving"
        [error]="hideError"
        (close)="hiding = null; hideError = ''"
        (confirm)="hide($event)"
      />
    }
  </section>`,
})
export class ProductCommentsComponent implements OnChanges, OnInit, OnDestroy {
  shop = inject(ShopService);
  private notifications = inject(NotificationsService);
  @Input({ required: true }) productId!: string;

  data: CommentList | null = null;
  error = '';
  showHidden = false;
  date = dateTime;

  content = '';
  formError = '';
  saving = false;

  replyTo: string | null = null;
  replyText = '';
  replyError = '';

  hiding: ProductComment | null = null;
  hideError = '';
  private liveSub?: Subscription;

  ngOnInit() {
    this.liveSub = this.notifications.commentUpdates.subscribe((ev) => {
      if (ev.product_id === this.productId) void this.load();
    });
  }

  ngOnDestroy() {
    this.liveSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['productId']) {
      this.data = null;
      this.replyTo = null;
      void this.load();
    }
  }

  async load() {
    try {
      this.data = await this.shop.getComments(this.productId, this.shop.isTeam && this.showHidden);
      this.error = '';
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  toggleReply(id: string) {
    this.replyTo = this.replyTo === id ? null : id;
    this.replyText = '';
    this.replyError = '';
  }

  async submitRoot(e: Event) {
    e.preventDefault();
    this.formError = '';
    this.saving = true;
    try {
      await this.shop.postComment(this.productId, this.content.trim());
      this.content = '';
      this.shop.notify('Đã gửi bình luận.');
      await this.load();
    } catch (err) {
      this.formError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async submitReply(e: Event, parent: ProductComment) {
    e.preventDefault();
    this.replyError = '';
    this.saving = true;
    try {
      await this.shop.postComment(this.productId, this.replyText.trim(), parent.id);
      this.replyTo = null;
      this.replyText = '';
      this.shop.notify(this.shop.isTeam ? 'Đã gửi phản hồi từ shop.' : 'Đã gửi trả lời.');
      await this.load();
    } catch (err) {
      this.replyError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async hide(reason: string) {
    if (!this.hiding) return;
    this.saving = true;
    this.hideError = '';
    try {
      await this.shop.moderateComment(this.hiding.id, reason);
      this.shop.notify('Đã ẩn bình luận.');
      this.hiding = null;
      await this.load();
    } catch (e) {
      this.hideError = (e as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async unhide(c: ProductComment) {
    this.saving = true;
    try {
      await this.shop.moderateComment(c.id, null);
      this.shop.notify('Đã hiện lại bình luận.');
      await this.load();
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    } finally {
      this.saving = false;
    }
  }
}
