import type { StockMovementType } from '@/domain/types';

type ProductLike = {
  id: number;
  type: string;
  criticalSupplyType: string | null;
};

type RecipeLike = {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: { name: string } | null;
};

export function collectStockProductIdsToLock(
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductLike>,
  recipesByProduct: Map<number, RecipeLike[]>
): number[] {
  const productIdsToLock = new Set<number>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;
        productIdsToLock.add(recipeItem.supplyId);
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      productIdsToLock.add(product.id);
    }
  }

  return Array.from(productIdsToLock);
}

export function* iterRecipeConsumptions(
  product: ProductLike,
  quantity: number,
  recipesByProduct: Map<number, RecipeLike[]>
): Generator<{ supplyId: number; consumed: number; supplyName: string }> {
  if (product.type !== 'compound') return;

  const recipeList = recipesByProduct.get(product.id) ?? [];
  for (const recipeItem of recipeList) {
    if (!recipeItem.autoDiscount) continue;

    yield {
      supplyId: recipeItem.supplyId,
      consumed: recipeItem.quantity * quantity,
      supplyName: recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`,
    };
  }
}

export function buildStockMovementReason(
  movementType: string,
  saleId?: number,
  orderId?: number
): string | null {
  if (movementType === 'sale') {
    return saleId !== undefined ? `Venta #${saleId}` : 'Venta';
  }

  if (movementType === 'cancellation') {
    return saleId !== undefined
      ? `Anulación de venta #${saleId}`
      : 'Anulación de venta';
  }

  if (movementType === 'reserve') {
    return orderId !== undefined
      ? `Reservado para pedido #${orderId}`
      : 'Reservado';
  }

  if (movementType === 'reserve_release') {
    return orderId !== undefined
      ? `Reserva liberada del pedido #${orderId}`
      : 'Reserva liberada';
  }

  return null;
}

export const STOCK_MOVEMENT_TYPES: readonly StockMovementType[] = [
  'sale',
  'cancellation',
  'manual_adjustment',
  'restock',
  'reserve',
  'reserve_release',
];
