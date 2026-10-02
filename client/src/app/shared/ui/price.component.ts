import { Component, Input } from '@angular/core';
import type { Product } from '../../features/products/types';
import { money } from '../formatters';

@Component({
  selector: 'app-price',
  standalone: true,
  template: `<span class="price"
    >{{ money(p.price) }}@if (p.original_price > p.price) {
      <del>{{ money(p.original_price) }}</del>
    }</span
  >`,
})
export class PriceComponent {
  @Input({ required: true }) p!: Product;
  readonly money = money;
}
