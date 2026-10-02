import { Component } from '@angular/core';

@Component({
  selector: 'app-policy-page',
  standalone: true,
  template: `<main class="container section policy-page">
    <p class="eyebrow">M&A CARE</p>
    <h1>Mua sắm an tâm</h1>
    <details open>
      <summary>Giao hàng & thanh toán</summary>
      <p>
        Phí giao hàng mẫu là 30.000đ, miễn phí từ 699.000đ. Luồng đặt hàng hiện dùng dữ liệu mẫu. COD và
        chuyển khoản chỉ để thử quy trình; shop chưa thu tiền hoặc giao hàng thật.
      </p>
    </details>
    <details>
      <summary>Đổi size & sản phẩm</summary>
      <p>
        Chính sách dự kiến: hỗ trợ đổi size trong 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên nhãn và
        chưa sử dụng. Liên hệ shop trước khi gửi sản phẩm.
      </p>
    </details>
    <details>
      <summary>Chăm sóc trang phục</summary>
      <p>
        Giặt cùng màu, ưu tiên nước mát và phơi trong bóng râm. Kiểm tra nhãn hướng dẫn trên từng sản phẩm
        để giữ chất liệu bền đẹp.
      </p>
    </details>
    <details>
      <summary>Thông tin cá nhân</summary>
      <p>
        Tên, số điện thoại và địa chỉ chỉ dùng trong luồng xử lý đơn hàng. Khách hàng xem được đơn của
        mình; đội ngũ cửa hàng truy cập theo quyền được cấp.
      </p>
    </details>
  </main>`,
})
export class PolicyPageComponent {}
