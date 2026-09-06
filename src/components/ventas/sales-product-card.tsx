'use client';

import {
  getProductAdditional,
  isProductOutOfStock,
  type SellableProduct,
} from '@/lib/ventas-helpers';
import { ProductCardBase } from '@/components/productos/product-card-base';

interface SalesProductCardProps {
  product: SellableProduct;
  cartAvailability: Record<number, number>;
  inCartQuantity: number;
  cartDisabled: boolean;
  onAdd: (product: SellableProduct) => void;
}

export function SalesProductCard({
  product,
  cartAvailability,
  inCartQuantity,
  cartDisabled,
  onAdd,
}: SalesProductCardProps) {
  const additional = getProductAdditional(
    product,
    cartAvailability,
    inCartQuantity
  );
  const isOutOfStock = isProductOutOfStock(
    product,
    cartAvailability,
    inCartQuantity
  );

  const maxAdditional =
    product.type === 'service' ? Number.MAX_SAFE_INTEGER : additional;

  return (
    <ProductCardBase
      variant="sales"
      product={product}
      isOutOfStock={isOutOfStock}
      inCartQuantity={inCartQuantity}
      disabled={cartDisabled}
      maxAdditional={maxAdditional}
      onAdd={() => onAdd(product)}
    />
  );
}
