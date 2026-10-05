export type Role = 'admin' | 'manager' | 'staff' | 'customer';
export const roleNames: Record<Role, string> = { admin: 'Chủ shop', manager: 'Quản lý', staff: 'Nhân viên', customer: 'Khách hàng' };
export type Member = {
    id: string;
    name: string;
    email: string;
    role: Role;
    active: number;
    demo: number;
    created_at?: string;
    birthday?: string | null;
    birthday_updated_at?: string | null;
    phone_e164?: string | null;
    phone_verified?: number;
};
export type Session = {
    user: Member | null;
    canPreview: boolean;
    preview: boolean;
};
