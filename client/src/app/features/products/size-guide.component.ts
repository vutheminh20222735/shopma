import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../shop/shop.service';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-size-guide',
  standalone: true,
  imports: [ModalComponent, FormsModule],
  template: `<app-modal title="Giúp tôi chọn size" (close)="shop.sizeGuide = false">
    <div class="size-guide-form">
      <div class="field-grid">
        <label>
          Chiều cao (cm)
          <input type="number" min="120" max="220" [ngModel]="height" (ngModelChange)="height = $event" />
        </label>
        <label>
          Cân nặng (kg)
          <input type="number" min="30" max="180" [ngModel]="weight" (ngModelChange)="weight = $event" />
        </label>
        <label>
          Vòng ngực (cm)
          <input type="number" min="60" max="150" [ngModel]="chest" (ngModelChange)="chest = $event" />
        </label>
        <label>
          Sở thích mặc
          <select [ngModel]="fit" (ngModelChange)="fit = $event">
            <option value="vừa">Vừa</option>
            <option value="ôm">Ôm</option>
            <option value="rộng">Rộng</option>
          </select>
        </label>
      </div>
      <p class="muted">Chiều cao và cân nặng chỉ là tham khảo. Bảng đo sản phẩm và chiếc áo bạn đang mặc là căn cứ trực tiếp hơn.</p>
      <button class="button black" type="button" (click)="recommend()" [disabled]="shop.busy">Gợi ý size</button>
      @if (result) {
        <div class="size-result">
          <h3>Đề xuất: <strong>{{ result.recommendedSize }}</strong></h3>
          <p>{{ result.reason }}</p>
          @if (result.alternatives.length) {
            <ul>
              @for (alt of result.alternatives; track alt.size) {
                <li>{{ alt.size }}: {{ alt.reason }}</li>
              }
            </ul>
          }
          <p class="muted">{{ result.note }}</p>
        </div>
      }
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Size</th>
            <th>Vòng ngực</th>
            <th>Chiều cao</th>
            <th>Cân nặng</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows; track r[0]) {
            <tr>
              @for (v of r; track v) {
                <td>{{ v }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="muted">Từng phom và chất liệu có thể khác nhau. Nếu không chắc chắn, theo dõi thêm kích cỡ của chiếc áo đang mặc và nhắn shop nếu cần hỗ trợ.</p>
  </app-modal>`,
})
export class SizeGuideComponent {
  shop = inject(ShopService);
  @Input() product: any = null;
  height: number | null = null;
  weight: number | null = null;
  chest: number | null = null;
  fit: 'vừa' | 'ôm' | 'rộng' = 'vừa';
  result: any = null;
  rows = [
    ['S', '82–90 cm', '155–165 cm', '45–55 kg'],
    ['M', '90–98 cm', '160–172 cm', '55–65 kg'],
    ['L', '98–106 cm', '168–180 cm', '65–75 kg'],
    ['XL', '106–114 cm', '175–185 cm', '75–85 kg'],
  ];

  async recommend() {
    if (!this.product) {
      this.result = {
        recommendedSize: 'M',
        reason: 'Hãy điền thêm số đo để hệ thống gợi ý chính xác hơn.',
        alternatives: [{ size: 'L', reason: 'Nếu bạn thích mặc rộng hơn, chọn L.' }],
        note: 'Hiện đang dùng bảng đo mặc định cho áo dáng thoải mái.',
      };
      return;
    }
    try {
      this.result = await this.shop.getSizeRecommendation(this.product.id, {
        height_cm: this.height,
        weight_kg: this.weight,
        chest_cm: this.chest,
        fit: this.fit,
      });
    } catch (e) {
      this.result = {
        recommendedSize: 'M',
        reason: 'Dữ liệu chưa đủ để gợi ý chính xác. Hãy bổ sung chiều cao và vòng ngực.',
        alternatives: [{ size: 'L', reason: 'Phương án nếu bạn muốn mặc rộng hơn.' }],
        note: 'Bạn có thể đối chiếu với chiếc áo đang mặc để chọn.',
      };
    }
  }
}
