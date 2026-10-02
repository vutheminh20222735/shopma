import { Component, inject } from '@angular/core';
import { ShopService } from '../../shop/shop.service';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-size-guide',
  standalone: true,
  imports: [ModalComponent],
  template: `<app-modal title="Chọn size vừa với bạn" (close)="shop.sizeGuide = false">
    <p>
      Số đo tham khảo cho áo phom thường. Nếu thích mặc rộng, bạn có thể chọn lớn hơn một size.
    </p>
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
    <p class="muted">Từng phom và chất liệu có thể khác nhau. Nhắn shop nếu bạn cần tư vấn kỹ hơn.</p>
  </app-modal>`,
})
export class SizeGuideComponent {
  shop = inject(ShopService);
  rows = [
    ['S', '82–90 cm', '155–165 cm', '45–55 kg'],
    ['M', '90–98 cm', '160–172 cm', '55–65 kg'],
    ['L', '98–106 cm', '168–180 cm', '65–75 kg'],
    ['XL', '106–114 cm', '175–185 cm', '75–85 kg'],
  ];
}
