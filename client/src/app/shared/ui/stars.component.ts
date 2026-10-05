import { Component, Input } from '@angular/core';
import { IconsComponent } from '../icons.component';

@Component({
  selector: 'app-stars',
  standalone: true,
  imports: [IconsComponent],
  template: `<span class="stars" role="img" [attr.aria-label]="value.toFixed(1) + ' trên 5 sao'">
    @for (i of [1, 2, 3, 4, 5]; track i) {
      <app-icon name="star" [size]="size" [strokeWidth]="1.5" [fill]="i <= rounded ? 'currentColor' : 'none'" />
    }
  </span>`,
})
export class StarsComponent {
  @Input({ required: true }) value!: number;
  @Input() size = 16;

  get rounded() {
    return Math.round(this.value);
  }
}
