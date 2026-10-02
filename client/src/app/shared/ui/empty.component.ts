import { Component, Input } from '@angular/core';
import { IconsComponent } from '../icons.component';

@Component({
  selector: 'app-empty',
  standalone: true,
  imports: [IconsComponent],
  template: `<div class="empty">
    <app-icon name="shopping-bag" [size]="38" [strokeWidth]="1" />
    <h2>{{ title }}</h2>
    @if (text) {
      <p>{{ text }}</p>
    }
    <ng-content />
  </div>`,
})
export class EmptyComponent {
  @Input({ required: true }) title!: string;
  @Input() text?: string;
}
