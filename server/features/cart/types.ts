import type { Product } from '@server/features/products/types';
export type CartItem = {
    id: string;
    variant_id: string;
    product_id: string;
    size: string;
    color: string;
    quantity: number;
    product: Product;
    stock: number;
};
