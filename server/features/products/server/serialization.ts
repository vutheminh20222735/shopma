import type { Product } from '@server/shared/shop-types';
export const productRow = (p: any): Product => ({ ...p, colors: JSON.parse(p.colors), sizes: JSON.parse(p.sizes) });
