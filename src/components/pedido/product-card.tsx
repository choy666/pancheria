'use client';

import { ProductCardBase } from '@/components/productos/product-card-base';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  inCartQuantity?: number;
  breakdown: RecipeBreakdownItem[];
  onAdd: (selectedRecipeItemIds?: number[]) => void;
  disabled?: boolean;
  showBreakdown?: boolean;
}

export function ProductCard({
  product,
  inCart,
  inCartQuantity = 0,
  breakdown,
  onAdd,
  disabled = false,
  showBreakdown = true,
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
      breakdown={breakdown}
      showBreakdown={showBreakdown}
      onAdd={onAdd}
    />
  );
}
