export type Order = {
  id: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  address: string;
  note: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: string;
  payment: string;
  items: {
    product_id: string;
    name: string;
    image: string;
    price: number;
    size: string;
    color: string;
    quantity: number;
    variant_id: string;
  }[];
  created_at: string;
};
export const statusNames: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};
