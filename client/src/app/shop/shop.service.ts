import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { api } from '../shared/api';
import type { Notice } from '../shared/types';
import type { CartItem } from '../features/cart/types';
import type { Product } from '../features/products/types';
import type { Session, Role } from '../features/accounts/types';
import { roleNames } from '../features/accounts/types';
import type { Settings } from '../features/contacts/types';
import { blankSettings } from '../features/contacts/constants';
import { filterProducts } from '../features/products/filter-products';

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
      const [p, s, c] = await Promise.all([
        api<Product[]>('products'),
        api<Session>('session'),
        api<Settings>('settings'),
      ]);
      this.products = p;
      this.session = s;
      this.settings = c;
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

  async switchRole(role: Role | 'exit') {
    await this.run(async () => {
      await api('preview', 'POST', { role });
      await this.reload();
      this.go(role === 'customer' ? '/' : role === 'exit' ? '/tai-khoan' : '/quan-tri');
    }, role === 'exit' ? 'Đã về tài khoản chủ shop.' : 'Đang xem với vai trò ' + roleNames[role as Role]);
  }
}
