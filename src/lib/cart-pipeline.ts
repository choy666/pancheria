import { and, eq, inArray, asc } from 'drizzle-orm';
import { products } from '@/db/schema';
import type { ProductRow, RecipeItemConfig, SaleItemInput } from '@/domain/types';
import type { RecipeWithSupply } from '@/lib/recipe-helpers';
import {
  assertNoStockShortage,
  buildProductContext,
  validateCartAvailability,
  validateProductsForOperation,
} from '@/lib/product-helpers';
import { buildSaleItemValues, type SaleItemValue } from '@/lib/sale-helpers';
import { collectStockProductIdsToLock } from '@/lib/stock-helpers';

/**
 * Items que se usan para construir los valores de venta/pedido.
 * Extiende `SaleItemInput` para soportar datos históricos de una orden ya existente.
 */
interface CartPipelineBuildItemInput extends SaleItemInput {
  unitPrice?: number;
  subtotal?: number;
  recipeSnapshot?: RecipeItemConfig[];
}

export interface CartPipelineInput {
  branchId: number;
  items: SaleItemInput[];
  operation: 'venta' | 'pedido';
  dbOrTx: typeof import('@/db').db;
  options?: {
    shouldLock?: boolean;
    buildItems?: CartPipelineBuildItemInput[];
    excludeOrderId?: number;
  };
}

export interface CartPipelineResult {
  productById: Map<number, ProductRow>;
  recipesByProduct: Map<number, RecipeWithSupply[]>;
  saleItemValues: SaleItemValue[];
  total: number;
  shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  >;
}

/**
 * Centraliza la construcción del contexto de productos, validación de disponibilidad,
 * bloqueo de stock y cálculo de los valores de ítems para ventas y pedidos.
 * El orden de operaciones se mantiene idéntico al flujo anterior:
 * buildProductContext -> lock (opcional) -> validateProductsForOperation ->
 * validateCartAvailability -> assertNoStockShortage -> buildSaleItemValues.
 */
export async function prepareCart(
  input: CartPipelineInput
): Promise<CartPipelineResult> {
  const { branchId, items, operation, dbOrTx, options = {} } = input;
  const { shouldLock = false, buildItems, excludeOrderId } = options;

  const productIds = items.map((item) => item.productId);
  const { productById, recipesByProduct } = await buildProductContext(
    branchId,
    productIds,
    { dbOrTx }
  );

  if (shouldLock) {
    const productIdsToLock = collectStockProductIdsToLock(
      items,
      productById,
      recipesByProduct
    );

    if (productIdsToLock.length > 0) {
      await dbOrTx
        .select()
        .from(products)
        .where(
          and(
            eq(products.branchId, branchId),
            inArray(products.id, productIdsToLock)
          )
        )
        .orderBy(asc(products.id))
        .for('update');
    }
  }

  validateProductsForOperation(items, productById, branchId, operation);

  const { shortageByProduct } = await validateCartAvailability(
    branchId,
    items,
    undefined,
    dbOrTx,
    excludeOrderId
  );

  assertNoStockShortage(shortageByProduct, productById);

  const itemsForBuild = buildItems ?? items;
  const { saleItemValues, total } = buildSaleItemValues(
    productById,
    itemsForBuild,
    recipesByProduct
  );

  return {
    productById,
    recipesByProduct,
    saleItemValues,
    total,
    shortageByProduct,
  };
}
