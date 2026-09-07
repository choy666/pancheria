import type { RecipeItemConfig, StockMovementType } from '@/domain/types';
import { nowUTC } from '@/lib/date';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import type { StockMovementInsert } from '@/repositories/stockMovementRepository';

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

type ItemWithRecipeSnapshot = {
  productId: number;
  quantity: number;
  recipeSnapshot?: RecipeItemConfig[];
};

function hasSupplyName(
  recipe: RecipeItemConfig | RecipeLike
): recipe is RecipeItemConfig {
  return 'supplyName' in recipe;
}

export function collectStockProductIdsToLock(
  items: ItemWithRecipeSnapshot[],
  productById: Map<number, ProductLike>,
  recipesByProduct: Map<number, RecipeLike[]>
): number[] {
  const productIdsToLock = new Set<number>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      const recipeList =
        item.recipeSnapshot?.length
          ? item.recipeSnapshot
          : (recipesByProduct.get(product.id) ?? []);
      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;
        if (hasSupplyName(recipeItem) && !recipeItem.selected) continue;
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
  recipesByProduct: Map<number, RecipeLike[]>,
  recipeSnapshot?: RecipeItemConfig[]
): Generator<{ supplyId: number; consumed: number; supplyName: string }> {
  if (product.type !== 'compound') return;

  const recipeList =
    recipeSnapshot?.length
      ? recipeSnapshot
      : (recipesByProduct.get(product.id) ?? []);
  for (const recipeItem of recipeList) {
    if (!recipeItem.autoDiscount) continue;
    if (hasSupplyName(recipeItem) && !recipeItem.selected) continue;

    const supplyName = hasSupplyName(recipeItem)
      ? recipeItem.supplyName
      : recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;

    yield {
      supplyId: recipeItem.supplyId,
      consumed: recipeItem.quantity * quantity,
      supplyName,
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

/**
 * Reintegra el stock de los ítems dados (insumos de recetas y bebidas) e
 * inserta los movimientos correspondientes. Se usa al anular ventas y al
 * eliminar definitivamente cajas con ventas.
 */
export async function reintegrateStockForItems(
  tx: typeof import('@/db').db,
  branchId: number,
  items: ItemWithRecipeSnapshot[],
  productById: Map<number, ProductLike>,
  recipesByProduct: Map<number, RecipeLike[]>,
  source: { saleId?: number },
  movementType: StockMovementType,
  reasonOverride?: string
) {
  const idsToLock = collectStockProductIdsToLock(
    items,
    productById,
    recipesByProduct
  );

  const reason =
    reasonOverride ?? buildStockMovementReason(movementType, source.saleId);

  if (idsToLock.length > 0) {
    await productRepository.lockForUpdate(tx, idsToLock);
  }

  const movementRows: StockMovementInsert[] = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      const recipeSnapshot = item.recipeSnapshot ?? [];
      for (const { supplyId, consumed: reintegrated } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct,
        recipeSnapshot
      )) {
        await productRepository.incrementStock(tx, supplyId, reintegrated);

        movementRows.push({
          branchId,
          productId: supplyId,
          type: movementType,
          quantity: reintegrated,
          saleId: source.saleId ?? null,
          orderId: null,
          reason,
          createdAt: nowUTC(),
        });
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      await productRepository.incrementStock(tx, product.id, item.quantity);

      movementRows.push({
        branchId,
        productId: product.id,
        type: movementType,
        quantity: item.quantity,
        saleId: source.saleId ?? null,
        orderId: null,
        reason,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service' || product.type === 'manual_supply') {
      // Los servicios y los insumos manuales no reintegran stock al anularse.
    }
  }

  await stockMovementRepository.insertMany(tx, movementRows);
}

export const STOCK_MOVEMENT_TYPES: readonly StockMovementType[] = [
  'sale',
  'cancellation',
  'manual_adjustment',
  'restock',
  'reserve',
  'reserve_release',
];
