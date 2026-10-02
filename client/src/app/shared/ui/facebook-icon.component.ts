import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-facebook-icon',
  standalone: true,
  template: `<span
    aria-hidden="true"
    [style.display]="'inline-flex'"
    [style.alignItems]="'center'"
    [style.justifyContent]="'center'"
    [style.fontFamily]="'Arial'"
    [style.fontWeight]="700"
    [style.fontSize.px]="size"
    [style.width.px]="size"
    [style.height.px]="size"
    [style.lineHeight]="1"
    [style.flexShrink]="0"
    >f</span
  >`,
})
export class FacebookIconComponent {
  @Input() size = 24;
}
