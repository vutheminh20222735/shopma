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
    reviewed?: boolean;
    can_review?: boolean;
  }[];
  created_at: string;
  coupon_code?: string;
  offer_id?: string;
  tracking_code?: string;
  payment_status?: string;
  refund_status?: string;
  confirmed_at?: string | null;
  version?: number;
  /** Khách đã nhận hàng (đơn giao + đã thanh toán). */
  received?: boolean;
  /** Sản phẩm trong đơn chưa đánh giá. */
  review_pending?: { product_id: string; name: string; image: string }[];
  /** Đã đánh giá hết sản phẩm trong đơn. */
  all_reviewed?: boolean;
};

export type OrderEvent = {
  id: string;
  status: string;
  note: string;
  actor_name: string;
  created_at: string;
};

export type Shipment = {
  provider: string;
  tracking_code: string;
  status: string;
  fee: number;
  cod_collected: number;
  updated_at: string;
} | null;

export type OrderDetail = Order & {
  events: OrderEvent[];
  tracking: { code?: string; shipment: Shipment };
  payment_info: {
    method: string;
    status: string;
    transactions: { provider: string; status: string; amount: number; created_at: string }[];
  };
  refund_info: {
    status: string;
    refund: { id: string; amount: number; status: string; note: string; created_at: string; confirmed_at: string | null } | null;
  };
};

export const statusNames: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  packing: 'Đang đóng gói',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

/** Nhãn cho mốc trên dòng thời gian (gồm cả mốc thanh toán/hoàn tiền do hệ thống ghi). */
export const eventNames: Record<string, string> = {
  ...statusNames,
  paid: 'Đã nhận thanh toán',
  refund_pending: 'Chờ hoàn tiền',
  refund_confirmed: 'Đã hoàn tiền',
};

export const paymentMethodNames: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  transfer: 'Chuyển khoản ngân hàng',
};

export const paymentStatusNames: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

export const shipmentStatusNames: Record<string, string> = {
  created: 'Đã tạo vận đơn',
  picked_up: 'Đã lấy hàng',
  in_transit: 'Đang vận chuyển',
  delivered: 'Đã giao thành công',
  returned: 'Hoàn về cửa hàng',
  failed: 'Giao không thành công',
};
