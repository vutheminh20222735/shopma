import type { Variant } from '../inventory/types';

export type ProductImage = {
  id: string;
  path: string;
  sort_order: number;
  is_primary: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  gender: string;
  price: number;
  original_price: number;
  image: string;
  description: string;
  material: string;
  colors: string[];
  sizes: string[];
  is_new: number;
  active: number;
  variants?: Variant[];
  images?: ProductImage[];
};

export type StaffGrant = {
  id: string;
  name: string;
  email: string;
  can_edit: number;
};

export const swatches: Record<string, string> = {
  'Đen': '#202020',
  'Trắng': '#f6f5f0',
  'Kem': '#ded4c2',
  'Xám': '#999b9e',
  'Nâu': '#725643',
  'Xanh denim': '#58748b',
  'Xanh navy': '#2b364d',
  'Đỏ rượu': '#76283f',
};
