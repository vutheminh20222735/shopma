export type OfferSimulationItem = {
  name: string;
  quantity: number;
  price: number;
  cost: number;
};

export type OfferSimulationInput = {
  items: OfferSimulationItem[];
  shipping: number;
  paymentFee: number;
  packaging: number;
  otherCost: number;
  discount: number;
  campaign?: {
    name?: string;
    maxBudget?: number;
    usedBudget?: number;
  };
};

export type OfferSimulationResult = {
  revenueBeforeDiscount: number;
  revenueAfterDiscount: number;
  discountAmount: number;
  shippingRevenue: number;
  totalCost: number;
  profit: number;
  warnings: string[];
  campaignStatus: string;
};

export function simulateOfferImpact(input: OfferSimulationInput): OfferSimulationResult {
  const revenueBeforeDiscount = input.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discountAmount = Math.max(0, input.discount);
  const revenueAfterDiscount = revenueBeforeDiscount - discountAmount;
  const shippingRevenue = Math.max(0, input.shipping);
  const itemCost = input.items.reduce((sum, item) => sum + item.quantity * item.cost, 0);
  const totalCost = itemCost + shippingRevenue * 0.2 + input.paymentFee + input.packaging + input.otherCost;
  const profit = revenueAfterDiscount + shippingRevenue - totalCost;
  const warnings: string[] = [];

  if (profit < 0) warnings.push('Cảnh báo: lợi nhuận ước tính âm; cần xem lại mức giảm hoặc chi phí vận chuyển.');
  if ((input.campaign?.usedBudget ?? 0) > (input.campaign?.maxBudget ?? Infinity)) {
    warnings.push('Cảnh báo: ngân sách ưu đãi đã vượt ngưỡng cho phép.');
  }
  if (discountAmount > revenueBeforeDiscount * 0.25) {
    warnings.push('Cảnh báo: mức giảm đang rất cao so với doanh thu đơn hàng mẫu.');
  }

  return {
    revenueBeforeDiscount,
    revenueAfterDiscount,
    discountAmount,
    shippingRevenue,
    totalCost,
    profit,
    warnings,
    campaignStatus: ((input.campaign?.usedBudget ?? 0) > 0 && (input.campaign?.maxBudget ?? 0) > 0)
      ? `${Math.round(((input.campaign!.usedBudget ?? 0) / (input.campaign!.maxBudget ?? 1)) * 100)}% ngân sách đã sử dụng`
      : 'Chưa có ngân sách ưu đãi được kích hoạt',
  };
}
