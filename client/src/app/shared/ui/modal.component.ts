import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { IconsComponent } from '../icons.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconsComponent],
  template: `<div class="modal-backdrop" (click)="backdrop($event)">
    <div
      #dialog
      class="modal"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title"
      tabindex="-1"
    >
      <div class="modal-heading">
        <h2>{{ title }}</h2>
        <button class="icon-button" (click)="close.emit()" aria-label="Đóng">
          <app-icon name="x" />
        </button>
      </div>
      <ng-content />
    </div>
  </div>`,
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) title!: string;
  @Output() close = new EventEmitter<void>();
  @ViewChild('dialog') dialog?: ElementRef<HTMLDivElement>;

  private oldOverflow = '';
  private previousFocus: HTMLElement | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  ngAfterViewInit() {
    this.oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.previousFocus = document.activeElement as HTMLElement;
    this.dialog?.nativeElement.focus();
    document.addEventListener('keydown', this.keyHandler);
  }

  ngOnDestroy() {
    document.body.style.overflow = this.oldOverflow;
    document.removeEventListener('keydown', this.keyHandler);
    this.previousFocus?.focus();
  }

  backdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.close.emit();
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close.emit();
    if (e.key !== 'Tab') return;
    const root = this.dialog?.nativeElement;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),a[href]',
    );
    if (!targets.length) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
