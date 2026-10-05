export type ReportPeriod = 'day' | 'month' | 'year' | 'custom';

export type RevenueBucket = {
  period: string;
  orders: number;
  goods: number;
  discount: number;
  net_goods: number;
  shipping: number;
  total: number;
  refunds: number;
  pending_refunds: number;
  net_after_refunds: number;
};

export type RevenueReport = {
  timezone: string;
  granularity: 'day' | 'month' | 'year';
  from: string;
  to: string;
  definition: string;
  profit_available: boolean;
  data: RevenueBucket[];
  totals: RevenueBucket;
};

export type ReportQuery = { period: ReportPeriod; from?: string; to?: string };
