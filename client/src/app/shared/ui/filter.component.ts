import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [FormsModule],
  template: `<div class="filter-block">
    <h4>{{ label }}</h4>
    @for (v of values; track v) {
      <label class="check-label"
        ><input type="radio" [name]="label" [checked]="value === v" (change)="set.emit(v)" />{{ v }}</label
      >
    }
  </div>`,
})
export class FilterComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) values!: string[];
  @Input({ required: true }) value!: string;
  @Output() set = new EventEmitter<string>();
}
