import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `<img
    [class]="'brand-logo' + (light ? ' light' : '')"
    src="/images/logo-ma-shop.png"
    alt="M&A Shop"
    width="148"
    height="57"
  />`,
})
export class LogoComponent {
  @Input() light = false;
}
