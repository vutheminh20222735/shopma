import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { api, apiDownload, query } from '../shared/api';
import type { Notice } from '../shared/types';
import type { CartItem } from '../features/cart/types';
import type { Product, StaffGrant } from '../features/products/types';
import type { CommentList, ReviewPage } from '../features/reviews/types';
import type { OrderDetail } from '../features/orders/types';
import type { AppNotification } from '../features/notifications/types';
import type {
  AppliedOffer,
  IssuedOffer,
  MyOffers,
  OfferConfig,
  OfferConfigInput,
  OfferHistoryRow,
  OfferKind,
  Profile,
} from '../features/offers/types';
import type { ReportQuery, RevenueReport } from '../features/reports/types';
import type { SavedAddress } from '../features/addresses/types';
import type { Session, Role } from '../features/accounts/types';
import { roleNames } from '../features/accounts/types';
import type { Settings } from '../features/contacts/types';
import { blankSettings } from '../features/contacts/constants';
import { filterProducts } from '../features/products/filter-products';

export type ShopBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  mobile_image: string;
  href: string;
  active: number;
  sort_order: number;
  button_label?: string;
};

@Injectable({ providedIn: 'root' })
export class ShopService {
  private router = inject(Router);
  private actionLock = false;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  products: Product[] = [];
  session: Session = { user: null, canPreview: false, preview: false };
  settings: Settings = { ...blankSettings };
  cart: CartItem[] = [];
  favorites: string[] = [];
  banners: ShopBanner[] = [];
  notice: Notice | null = null;
  busy = false;
  loaded = false;
  loadError = '';

  mobileMenu = false;
  search = '';
  contactOpen = false;
  sizeGuide = false;
  category = 'Tất cả';
  gender = 'Tất cả';
  sizeFilter = 'Tất cả';
  priceFilter = 'Tất cả';
  sort = 'new';
  filterOpen = false;
  catalogMode = 'all';

  constructor() {
    void this.reload();
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.mobileMenu = false;
      this.syncCatalogFromUrl();
    });
    this.syncCatalogFromUrl();
  }

  get cartCount() {
    return this.cart.reduce((n, i) => n + i.quantity, 0);
  }

  get isTeam() {
    return !!this.session.user && this.session.user.role !== 'customer';
  }

  get isManagement() {
    return !!this.session.user && ['admin', 'manager'].includes(this.session.user.role);
  }

  get filteredProducts() {
    return filterProducts(this.products, {
      gender: this.gender,
      category: this.category,
      sizeFilter: this.sizeFilter,
      priceFilter: this.priceFilter,
      search: this.search,
      catalogMode: this.catalogMode,
      sort: this.sort,
    });
  }

  syncCatalogFromUrl() {
    const url = this.router.url.split('?')[0];
    if (url !== '/san-pham') return;
    const q = new URLSearchParams(this.router.url.includes('?') ? this.router.url.split('?')[1] : '');
    this.gender = ['Nam', 'Nữ', 'Unisex'].includes(q.get('gender') || '') ? q.get('gender')! : 'Tất cả';
    this.catalogMode = ['new', 'sale'].includes(q.get('mode') || '') ? q.get('mode')! : 'all';
    this.search = q.get('q') || '';
    this.category = 'Tất cả';
    this.sizeFilter = 'Tất cả';
    this.priceFilter = 'Tất cả';
    this.filterOpen = false;
  }

  async reload() {
    try {
      const [p, s, c, b] = await Promise.all([
        api<Product[]>('products'),
        api<Session>('session'),
        api<Settings>('settings'),
        api<ShopBanner[]>('banners'),
      ]);
      this.products = p;
      this.session = s;
      this.settings = c;
      this.banners = b ?? [];
      if (s.user) {
        const [items, f] = await Promise.all([api<CartItem[]>('cart'), api<string[]>('favorites')]);
        this.cart = items;
        this.favorites = f;
      } else {
        this.cart = [];
        this.favorites = [];
      }
      this.loadError = '';
      this.loaded = true;
    } catch (e) {
      this.loadError = (e as Error).message;
      this.loaded = true;
    }
  }

  go(path: string) {
    void this.router.navigateByUrl(path);
    this.mobileMenu = false;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  resetFilters() {
    this.category = 'Tất cả';
    this.sizeFilter = 'Tất cả';
    this.priceFilter = 'Tất cả';
    this.sort = 'new';
  }

  navCatalog(g = 'Tất cả', mode = 'all') {
    this.resetFilters();
    this.gender = g;
    this.catalogMode = mode;
    this.search = '';
    this.go('/san-pham?gender=' + encodeURIComponent(g) + '&mode=' + mode);
  }

  searchCatalog(query: string) {
    this.resetFilters();
    this.search = query;
    this.catalogMode = 'all';
    this.gender = 'Tất cả';
    this.go('/san-pham?q=' + encodeURIComponent(query));
  }

  notify(text: string, error = false) {
    this.notice = { text, error };
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
    }, 4500);
  }

  clearNotice() {
    this.notice = null;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  async run<T>(fn: () => Promise<T>, message?: string): Promise<T | undefined> {
    if (this.actionLock) return undefined;
    this.actionLock = true;
    this.busy = true;
    try {
      const result = await fn();
      if (message) this.notify(message);
      return result;
    } catch (e) {
      this.notify((e as Error).message, true);
      return undefined;
    } finally {
      this.actionLock = false;
      this.busy = false;
    }
  }

  requireLogin() {
    if (!this.session.user) {
      this.go('/tai-khoan');
      this.notify('Đăng nhập để lưu sản phẩm và giỏ hàng.');
      return false;
    }
    return true;
  }

  async favorite(p: Product) {
    if (!this.requireLogin()) return;
    await this.run(async () => {
      await api('favorites/' + p.id, this.favorites.includes(p.id) ? 'DELETE' : 'POST', {});
      this.favorites = await api<string[]>('favorites');
    }, this.favorites.includes(p.id) ? 'Đã bỏ lưu sản phẩm.' : 'Đã lưu vào yêu thích.');
  }

  // ---------- Đánh giá & hỏi đáp ----------
  getReviews(productId: string, opts: { stars?: number; page?: number; includeHidden?: boolean } = {}) {
    return api<ReviewPage>(
      `products/${encodeURIComponent(productId)}/reviews` +
        query({ stars: opts.stars || undefined, page: opts.page, include_hidden: opts.includeHidden }),
    );
  }

  createReview(productId: string, rating: number, content: string) {
    return api<{ id: string; verified_purchase: boolean }>('reviews', 'POST', { product_id: productId, rating, content });
  }

  updateReview(reviewId: string, rating: number, content: string) {
    return api('reviews/' + encodeURIComponent(reviewId), 'PATCH', { rating, content });
  }

  /** reason = null -> hiện lại đánh giá. */
  moderateReview(reviewId: string, reason: string | null) {
    return api(
      `reviews/${encodeURIComponent(reviewId)}/hide`,
      'POST',
      reason === null ? { hidden: false } : { hidden: true, reason },
    );
  }

  getComments(productId: string, includeHidden = false) {
    return api<CommentList>(
      `products/${encodeURIComponent(productId)}/comments` + query({ include_hidden: includeHidden }),
    );
  }

  postComment(productId: string, content: string, parentId?: string) {
    return api<{ id: string; is_staff_reply: boolean }>(`products/${encodeURIComponent(productId)}/comments`, 'POST', {
      content,
      ...(parentId ? { parent_id: parentId } : {}),
    });
  }

  moderateComment(commentId: string, reason: string | null) {
    return api(
      `comments/${encodeURIComponent(commentId)}/hide`,
      'POST',
      reason === null ? { hidden: false } : { hidden: true, reason },
    );
  }

  // ---------- Đơn hàng ----------
  getOrder(orderId: string) {
    return api<OrderDetail>('orders/' + encodeURIComponent(orderId));
  }

  setOrderStatus(orderId: string, status: string, version?: number, note = '') {
    return api('orders/' + encodeURIComponent(orderId), 'PATCH', { status, note, version });
  }

  cancelOrder(orderId: string, note = '', version?: number) {
    return api(`orders/${encodeURIComponent(orderId)}/cancel`, 'POST', { note, version });
  }

  resizeOrderItem(orderId: string, variantId: string, size: string, version?: number) {
    return api<{ ok: boolean; total: number; price_delta: number }>(
      `orders/${encodeURIComponent(orderId)}/resize`,
      'POST',
      { variant_id: variantId, size, version },
    );
  }

  getProduct(productId: string, manage = false) {
    return api<Product>(`products/${encodeURIComponent(productId)}` + query({ manage }));
  }

  confirmPayment(orderId: string, note = '') {
    return api(`payments/${encodeURIComponent(orderId)}/confirm`, 'POST', { note });
  }

  confirmRefund(orderId: string, providerRef = '') {
    return api(`payments/${encodeURIComponent(orderId)}/refund-confirm`, 'POST', { provider_ref: providerRef });
  }

  createShipment(orderId: string) {
    return api(`shipping/${encodeURIComponent(orderId)}/create`, 'POST', {});
  }

  // ---------- Thông báo (nhân sự) ----------
  getNotifications(opts: { limit?: number; unread?: boolean } = {}) {
    return api<{ items: AppNotification[]; unread: number }>(
      'notifications' + query({ limit: opts.limit, unread: opts.unread }),
    );
  }

  markNotificationsRead(ids: string[] | 'all') {
    return ids === 'all' ? api('notifications/read-all', 'POST', {}) : api('notifications/read', 'POST', { ids });
  }

  // ---------- Ưu đãi & hồ sơ ----------
  getMyOffers() {
    return api<MyOffers>('my-offers');
  }

  getBanners() {
    return api<any[]>('banners');
  }

  getSizeRecommendation(productId: string, form: Record<string, unknown>) {
    return api<any>('products/size-guide', 'POST', { product_id: productId, ...form });
  }

  createGiftBox(payload: Record<string, unknown>) {
    return api<{ ok: boolean; token: string; shareUrl: string; expiresAt: string; product: any }>('gifts', 'POST', payload);
  }

  simulateOffer(payload: Record<string, unknown>) {
    return api<any>('offers/simulate', 'POST', payload);
  }

  getOfferReport(filters: Record<string, unknown>) {
    return api<any>('offers/report' + query(filters), 'GET');
  }

  applyOffer(code: string, subtotal: number) {
    return api<AppliedOffer>('offers/apply', 'POST', { code, subtotal });
  }

  getOfferConfigs() {
    return api<OfferConfig[]>('offers');
  }

  createOfferConfig(kind: OfferKind, milestone: number, values: OfferConfigInput) {
    return api<{ id: string }>('offers', 'POST', { kind, milestone, ...values });
  }

  updateOfferConfig(id: string, values: OfferConfigInput) {
    return api('offers/' + encodeURIComponent(id), 'PATCH', values);
  }

  disableOfferConfig(id: string) {
    return api('offers/' + encodeURIComponent(id), 'DELETE', {});
  }

  getOfferHistory() {
    return api<OfferHistoryRow[]>('offers/history');
  }

  getIssuedOffers() {
    return api<IssuedOffer[]>('offers/issued');
  }

  getProfile() {
    return api<Profile>('profile');
  }

  updateProfile(patch: { name?: string; phone?: string | null; birthday?: string | null }) {
    return api<Profile>('profile', 'PATCH', patch);
  }

  sendOtp(phone: string) {
    return api<{ ok: boolean; expires_in: number; mode: 'live' | 'test' }>('otp/send', 'POST', { phone });
  }

  verifyOtp(code: string, phone?: string) {
    return api<{ ok: boolean; phone_e164: string; verified: boolean; welcome_granted: boolean }>('otp/verify', 'POST', {
      code,
      ...(phone ? { phone } : {}),
    });
  }

  // ---------- Sổ địa chỉ ----------
  listAddresses() {
    return api<SavedAddress[]>('addresses');
  }

  createAddress(body: { label?: string; recipient_name: string; phone: string; address: string; is_default?: boolean }) {
    return api<SavedAddress>('addresses', 'POST', body);
  }

  updateAddress(id: string, body: Partial<{ label: string; recipient_name: string; phone: string; address: string; is_default: boolean }>) {
    return api<SavedAddress>('addresses/' + encodeURIComponent(id), 'PATCH', body);
  }

  setDefaultAddress(id: string) {
    return api(`addresses/${encodeURIComponent(id)}/default`, 'POST', {});
  }

  deleteAddress(id: string) {
    return api('addresses/' + encodeURIComponent(id), 'DELETE', {});
  }

  // ---------- Sản phẩm: ảnh, ngừng bán, quyền sửa ----------
  uploadProductImage(productId: string, dataUrl: string, primary = false) {
    return api<{ id: string; path: string; is_primary: boolean }>('uploads/' + encodeURIComponent(productId), 'POST', {
      data_url: dataUrl,
      primary,
    });
  }

  setPrimaryImage(productId: string, imageId: string) {
    return api(`uploads/${encodeURIComponent(productId)}/primary`, 'POST', { image_id: imageId });
  }

  reorderProductImages(productId: string, imageIds: string[]) {
    return api(`uploads/${encodeURIComponent(productId)}/reorder`, 'POST', { image_ids: imageIds });
  }

  deleteProductImage(imageId: string) {
    return api('uploads/' + encodeURIComponent(imageId), 'DELETE', {});
  }

  discontinueProduct(productId: string) {
    return api(`products/${encodeURIComponent(productId)}/discontinue`, 'POST', {});
  }

  restoreProduct(productId: string) {
    return api(`products/${encodeURIComponent(productId)}/restore`, 'POST', {});
  }

  getProductGrants() {
    return api<StaffGrant[]>('product-grants');
  }

  setProductGrant(memberId: string, canEdit: boolean) {
    return api('product-grants/' + encodeURIComponent(memberId), 'PATCH', { can_edit: canEdit });
  }

  // ---------- Báo cáo doanh thu ----------
  private reportQuery(q: ReportQuery, csv = false) {
    return query({
      period: q.period,
      from: q.period === 'custom' ? q.from : undefined,
      to: q.period === 'custom' ? q.to : undefined,
      format: csv ? 'csv' : undefined,
    });
  }

  getRevenueReport(q: ReportQuery) {
    return api<RevenueReport>('reports/revenue' + this.reportQuery(q));
  }

  async downloadRevenueCsv(q: ReportQuery) {
    const { blob, filename } = await apiDownload('reports/revenue' + this.reportQuery(q, true));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async switchRole(role: Role | 'exit') {
    await this.run(async () => {
      await api('preview', 'POST', { role });
      await this.reload();
      this.go(role === 'customer' ? '/' : role === 'exit' ? '/tai-khoan' : '/quan-tri');
    }, role === 'exit' ? 'Đã về tài khoản chủ shop.' : 'Đang xem với vai trò ' + roleNames[role as Role]);
  }
}
