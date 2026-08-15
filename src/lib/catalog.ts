import {
  groupProductsByType,
  type ProductGroup,
} from '@/lib/product-grouping';
import {
  criticalSupplyTypePriority,
  typePriority,
} from '@/lib/product-style';
import type { CriticalSupplyType, ProductType } from '@/domain/types';

export interface SellableProductLike {
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType | null;
}

export function isPublicSellableProduct(
  product: SellableProductLike | null | undefined
): boolean {
  if (!product) return false;

  return (
    product.type === 'compound' ||
    product.type === 'service' ||
    (product.type === 'critical_supply' && product.criticalSupplyType === 'beverage')
  );
}

export interface GroupableProductLike {
  type: ProductType;
  name: string;
  criticalSupplyType?: CriticalSupplyType | null;
}

export function groupPublicProductsByType<T extends GroupableProductLike>(
  products: T[]
): ProductGroup<T>[] {
  return groupProductsByType(products, typePriority, criticalSupplyTypePriority);
}
