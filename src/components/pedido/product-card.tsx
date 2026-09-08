'use client';

import { ProductCardBase } from '@/components/productos/product-card-base';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  inCartQuantity?: number;
  onAdd: (selectedRecipeItemIds?: number[]) => void;
  disabled?: boolean;
}

export function ProductCard({
  product,
  inCart,
  inCartQuantity = 0,
  onAdd,
  disabled = false,
}: ProductCardProps) {
  const isOutOfStock = product.type !== 'service' && product.availability <= 0;

  return (
    <ProductCardBase
      variant="catalog"
      product={product}
      isOutOfStock={isOutOfStock}
      inCart={inCart}
      inCartQuantity={inCartQuantity}
      disabled={disabled}
      onAdd={onAdd}
    />
  );
}
