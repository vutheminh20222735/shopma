import { Component } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `<div class="loading" role="status"><span class="spinner"></span>Đang tải…</div>`,
})
export class LoaderComponent {}
