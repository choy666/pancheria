'use client';

import { ProductCardBase } from '@/components/productos/product-card-base';
import type { PromoOptionsConfirmPayload } from '@/components/promo/promo-options-dialog';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface ProductCardProps {
  product: PublicCatalogProduct;
  inCart: boolean;
  inCartQuantity?: number;
  onAdd: (payload?: PromoOptionsConfirmPayload) => void;
  disabled?: boolean;
  /** `priority` de `next/image` para la primera fila del catálogo (LCP). */
  imagePriority?: boolean;
}

export function ProductCard({
  product,
  inCart,
  inCartQuantity = 0,
  onAdd,
  disabled = false,
  imagePriority = false,
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
      imagePriority={imagePriority}
      onAdd={onAdd}
    />
  );
}
