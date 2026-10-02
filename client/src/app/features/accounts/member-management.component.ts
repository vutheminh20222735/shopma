import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Member, Role } from './types';
import { roleNames } from './types';
import { api } from '../../shared/api';
import { ShopService } from '../../shop/shop.service';

type MemberRow = Member & { password?: string };

@Component({
  selector: 'app-member-management',
  standalone: true,
  imports: [FormsModule],
  template: `<div class="admin-panel">
      <h2>Tạo tài khoản nhân sự</h2>
      <p class="muted">
        Chủ shop tạo tài khoản quản lý hoặc nhân viên tại đây, rồi gửi email và mật khẩu cho họ để đăng nhập.
        Khách hàng tự đăng ký ở trang Tài khoản. Bảng bên dưới hiển thị tài khoản và mật khẩu của mọi thành viên.
      </p>
      <form
        class="member-editor"
        (submit)="
          $event.preventDefault();
          create()
        "
      >
        <label>Họ tên<input required minlength="2" maxlength="100" [(ngModel)]="form.name" name="name" /></label>
        <label>Email đăng nhập<input required type="email" maxlength="200" [(ngModel)]="form.email" name="email" /></label>
        <label
          >Mật khẩu
          <input
            required
            type="password"
            minlength="10"
            maxlength="128"
            autocomplete="new-password"
            [(ngModel)]="form.password"
            name="password"
            placeholder="Từ 10 ký tự"
          />
        </label>
        <label
          >Vai trò
          <select [(ngModel)]="form.role" name="role">
            @for (r of teamRoles; track r) {
              <option [value]="r">{{ roleNames[r] }}</option>
            }
          </select>
        </label>
        <button class="button black">Tạo tài khoản</button>
      </form>
    </div>
    <div class="admin-panel table-scroll">
      <h2>Tài khoản cửa hàng</h2>
      <table>
        <thead>
          <tr>
            <th>Thành viên</th>
            <th>Email / tài khoản</th>
            <th>Mật khẩu</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          @for (m of data.members; track m.id) {
            <tr>
              <td>
                <strong>{{ m.name }}</strong>
                @if (m.demo) {
                  <small class="block">Tài khoản mẫu</small>
                }
              </td>
              <td>
                <code>{{ m.email }}</code>
              </td>
              <td>
                @if (m.demo) {
                  <span class="muted">—</span>
                } @else if (m.password) {
                  <code class="password-plain">{{ m.password }}</code>
                  <button class="text-button" type="button" (click)="copyPassword(m)">Sao chép</button>
                } @else {
                  <span class="muted">Chưa lưu</span>
                }
              </td>
              <td>
                @if (m.role === 'admin' || m.demo) {
                  {{ roleNames[m.role] }}
                } @else {
                  <select [attr.aria-label]="'Vai trò của ' + m.name" [ngModel]="m.role" (ngModelChange)="update(m, { role: $event })">
                    @for (r of editableRoles; track r) {
                      <option [value]="r">{{ roleNames[r] }}</option>
                    }
                  </select>
                }
              </td>
              <td>{{ m.active ? 'Đang hoạt động' : 'Đã khóa' }}</td>
              <td>
                @if (m.role !== 'admin' && !m.demo) {
                  <button class="text-button" (click)="update(m, { active: m.active ? 0 : 1 })">
                    {{ m.active ? 'Tạm khóa' : 'Mở khóa' }}
                  </button>
                  <button class="text-button" (click)="resetPassword(m)">Đổi mật khẩu</button>
                  <button class="text-button danger" (click)="remove(m)">Xóa tài khoản</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>`,
})
export class MemberManagementComponent implements OnInit {
  shop = inject(ShopService);
  roleNames = roleNames;
  teamRoles: Role[] = ['manager', 'staff'];
  editableRoles: Role[] = ['manager', 'staff', 'customer'];

  data: { members: MemberRow[]; invitations: any[] } = { members: [], invitations: [] };
  form = { name: '', email: '', password: '', role: 'staff' as Role };

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.data = await api('members');
    } catch (e) {
      this.shop.notify((e as Error).message, true);
    }
  }

  create() {
    void this.shop.run(async () => {
      await api('members', 'POST', this.form);
      this.form = { name: '', email: '', password: '', role: 'staff' };
      await this.load();
    }, 'Đã tạo tài khoản. Hãy gửi email và mật khẩu cho nhân viên.');
  }

  update(m: MemberRow, values: Partial<{ role: Role; active: number; password: string }>) {
    void this.shop.run(async () => {
      await api('members/' + encodeURIComponent(m.id), 'PATCH', { role: m.role, active: m.active, ...values });
      await this.load();
    }, 'Đã cập nhật tài khoản.');
  }

  resetPassword(m: MemberRow) {
    const password = prompt(`Nhập mật khẩu mới cho ${m.name} (từ 10 ký tự):`, m.password || '');
    if (password === null) return;
    this.update(m, { password });
  }

  async copyPassword(m: MemberRow) {
    if (!m.password) return;
    try {
      await navigator.clipboard.writeText(m.password);
      this.shop.notify('Đã sao chép mật khẩu.');
    } catch {
      this.shop.notify('Không sao chép được. Hãy chọn và copy thủ công.', true);
    }
  }

  remove(m: MemberRow) {
    if (!confirm(`Xóa tài khoản ${m.name} (${m.email})? Người này sẽ không đăng nhập được nữa. Đơn hàng cũ vẫn được giữ.`)) {
      return;
    }
    void this.shop.run(async () => {
      await api('members/' + encodeURIComponent(m.id), 'DELETE', {});
      await this.load();
    }, 'Đã xóa tài khoản.');
  }
}
