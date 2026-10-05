import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-hide-reason-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `<app-modal [title]="title" (close)="close.emit()">
    <p>{{ text }}</p>
    <form class="editor-form" (submit)="submit($event)">
      <label
        >Lý do ẩn (bắt buộc)
        <textarea
          required
          minlength="3"
          maxlength="300"
          [(ngModel)]="reason"
          name="reason"
          placeholder="Ví dụ: nội dung không phù hợp, chứa thông tin cá nhân…"
        ></textarea>
      </label>
      @if (error) {
        <p class="form-error" role="alert">{{ error }}</p>
      }
      <div class="modal-actions">
        <button class="button outline" type="button" (click)="close.emit()">Để lại</button>
        <button class="button black" type="submit" [disabled]="busy">{{ busy ? 'Đang lưu…' : 'Ẩn nội dung' }}</button>
      </div>
    </form>
  </app-modal>`,
})
export class HideReasonModalComponent {
  @Input({ required: true }) title!: string;
  @Input() text = 'Nội dung sẽ không còn hiển thị với khách hàng. Lý do được lưu để đối chiếu về sau.';
  @Input() busy = false;
  @Input() error = '';
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  reason = '';

  submit(e: Event) {
    e.preventDefault();
    const reason = this.reason.trim();
    if (reason.length < 3) return;
    this.confirm.emit(reason);
  }
}
