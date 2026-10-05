export type Review = {
  id: string;
  product_id: string;
  rating: number;
  content: string;
  verified_purchase: boolean;
  verified_label: string;
  author: string;
  created_at: string;
  updated_at: string;
  mine: boolean;
  hidden?: boolean;
  hidden_reason?: string;
};

export type ReviewPage = {
  average: number;
  count: number;
  distribution: Record<string, number>;
  page: number;
  page_size: number;
  total: number;
  pages: number;
  can_review: boolean;
  my_review_id: string | null;
  items: Review[];
};

export type ProductComment = {
  id: string;
  parent_id: string;
  content: string;
  is_staff_reply: boolean;
  author: string;
  created_at: string;
  mine: boolean;
  hidden?: boolean;
  hidden_reason?: string;
  replies?: ProductComment[];
};

export type CommentList = {
  items: ProductComment[];
  count: number;
};
