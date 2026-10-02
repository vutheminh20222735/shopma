import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconsComponent } from '../../shared/icons.component';
import { FacebookIconComponent } from '../../shared/ui/facebook-icon.component';

@Component({
  selector: 'app-contact-card',
  standalone: true,
  imports: [NgTemplateOutlet, IconsComponent, FacebookIconComponent],
  template: `@if (href) {
      <a
        [class]="'contact-card' + (compact ? ' compact' : '')"
        [href]="href"
        [attr.target]="kind === 'phone' ? null : '_blank'"
        rel="noopener noreferrer"
      >
        <span [class]="'contact-channel ' + kind"><ng-container [ngTemplateOutlet]="icon" /></span>
        <div>
          <strong>{{ label }}</strong>
          <span>{{ value ? (kind === 'phone' ? value : 'Mở kênh liên hệ') : 'Chưa cập nhật' }}</span>
        </div>
        @if (value) {
          <app-icon name="external-link" [size]="16" />
        }
      </a>
    } @else {
      <div [class]="'contact-card disabled' + (compact ? ' compact' : '')">
        <span [class]="'contact-channel ' + kind"><ng-container [ngTemplateOutlet]="icon" /></span>
        <div>
          <strong>{{ label }}</strong>
          <span>Chưa cập nhật</span>
        </div>
      </div>
    }
    <ng-template #icon>
      @if (kind === 'zalo') {
        <app-icon name="message-circle" />
      } @else if (kind === 'facebook') {
        <app-facebook-icon />
      } @else {
        <app-icon name="phone" />
      }
    </ng-template>`,
})
export class ContactCardComponent {
  @Input({ required: true }) kind!: 'zalo' | 'facebook' | 'phone';
  @Input({ required: true }) value!: string;
  @Input() compact = false;

  get label() {
    return { zalo: 'Chat qua Zalo', facebook: 'Facebook', phone: 'Gọi M&A Shop' }[this.kind];
  }

  get href() {
    if (!this.value) return '';
    return this.kind === 'phone' ? 'tel:' + this.value.replace(/\s/g, '') : this.value;
  }
}
