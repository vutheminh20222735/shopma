export type Role = 'admin' | 'manager' | 'staff' | 'customer';
export const roleNames: Record<Role, string> = {
  admin: 'Chủ shop',
  manager: 'Quản lý',
  staff: 'Nhân viên',
  customer: 'Khách hàng',
};
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: number;
  demo: number;
};
export type Session = {
  user: Member | null;
  canPreview: boolean;
  preview: boolean;
};
