import { Routes } from '@angular/router';
import { ShopShellComponent } from './features/app/shop-shell.component';
import { HomePageComponent } from './features/home/home-page.component';
import { CatalogPageComponent } from './features/products/catalog-page.component';
import { ProductDetailComponent } from './features/products/product-detail.component';
import { FavoritesPageComponent } from './features/favorites/favorites-page.component';
import { CartCheckoutPageComponent } from './features/cart/cart-checkout-page.component';
import { AccountPageComponent } from './features/accounts/account-page.component';
import { ForgotPasswordPageComponent } from './features/accounts/forgot-password-page.component';
import { ResetPasswordPageComponent } from './features/accounts/reset-password-page.component';
import { ContactPageComponent } from './features/contacts/contact-page.component';
import { PolicyPageComponent } from './features/home/policy-page.component';
import { AdminAreaComponent } from './features/app/admin-area.component';
import { NotFoundPageComponent } from './features/app/not-found-page.component';

export const routes: Routes = [
  {
    path: '',
    component: ShopShellComponent,
    children: [
      { path: '', component: HomePageComponent },
      { path: 'san-pham', component: CatalogPageComponent },
      { path: 'san-pham/:id', component: ProductDetailComponent },
      { path: 'yeu-thich', component: FavoritesPageComponent },
      { path: 'gio-hang', component: CartCheckoutPageComponent, data: { checkout: false } },
      { path: 'thanh-toan', component: CartCheckoutPageComponent, data: { checkout: true } },
      { path: 'tai-khoan', component: AccountPageComponent },
      { path: 'quen-mat-khau', component: ForgotPasswordPageComponent },
      { path: 'dat-lai-mat-khau', component: ResetPasswordPageComponent },
      { path: 'lien-he', component: ContactPageComponent },
      { path: 'chinh-sach', component: PolicyPageComponent },
      { path: 'quan-tri', component: AdminAreaComponent },
      { path: 'quan-tri/:tab', component: AdminAreaComponent },
      { path: '**', component: NotFoundPageComponent },
    ],
  },
];
