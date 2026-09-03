export { areRecipeSelectionsEqual } from '@/lib/cart-helpers';

import type { ProductRow, RecipeItemConfig } from '@/domain/types';

export interface SellableProduct extends ProductRow {
  availability: number;
  recipe?: RecipeItemConfig[];
}

export interface CartItem {
  lineId: string;
  product: SellableProduct;
  quantity: number;
  selectedRecipeItemIds?: number[];
}

function sellablePriority(product: SellableProduct): number {
  if (product.type === 'compound') return 1;
  if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    return 2;
  }
  if (product.type === 'service') return 3;
  return 4;
}

export function sortSellableProducts(
  products: SellableProduct[]
): SellableProduct[] {
  return [...products].sort((a, b) => {
    const priorityA = sellablePriority(a);
    const priorityB = sellablePriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

export function getDefaultSelectedRecipeItemIds(
  product: SellableProduct
): number[] {
  return (
    product.recipe
      ?.filter((item) => item.isOptional && item.selectedByDefault)
      .map((item) => item.supplyId) ?? []
  );
}

export function getProductAdditional(
  product: SellableProduct,
  cartAvailability: Record<number, number>,
  cartQuantity: number
): number {
  if (product.type === 'service') return Number.MAX_SAFE_INTEGER;
  return (
    cartAvailability[product.id] ??
    Math.max((product.availability ?? 0) - cartQuantity, 0)
  );
}

export function isProductOutOfStock(
  product: SellableProduct,
  cartAvailability: Record<number, number>,
  cartQuantity: number
): boolean {
  if (product.type === 'service') return false;
  return getProductAdditional(product, cartAvailability, cartQuantity) <= 0;
}
