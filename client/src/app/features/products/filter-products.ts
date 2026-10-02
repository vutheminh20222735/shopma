import type { Product } from './types';
import { normalize } from './utils';

export type ProductFilters = {
  gender: string;
  category: string;
  sizeFilter: string;
  priceFilter: string;
  search: string;
  catalogMode: string;
  sort: string;
};

export function filterProducts(
  products: Product[],
  { gender, category, sizeFilter, priceFilter, search, catalogMode, sort }: ProductFilters,
) {
  return products
    .filter(
      (p) =>
        (gender === 'Tất cả' || p.gender === gender || p.gender === 'Unisex') &&
        (category === 'Tất cả' || p.category === category) &&
        (sizeFilter === 'Tất cả' || p.sizes.includes(sizeFilter)) &&
        (priceFilter === 'Tất cả' ||
          (priceFilter === 'under' && p.price < 300000) ||
          (priceFilter === 'mid' && p.price >= 300000 && p.price <= 600000) ||
          (priceFilter === 'above' && p.price > 600000)) &&
        (!search || normalize(p.name + ' ' + p.category + ' ' + p.material).includes(normalize(search))) &&
        (catalogMode !== 'new' || p.is_new) &&
        (catalogMode !== 'sale' || p.original_price > p.price),
    )
    .sort((a, b) =>
      sort === 'asc' ? a.price - b.price : sort === 'desc' ? b.price - a.price : b.is_new - a.is_new,
    );
}
