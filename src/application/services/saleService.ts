import { eq, sql, and, inArray, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  cashRegisters,
  products,
  sales,
  saleItems,
  stockMovements,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import { isIdempotencyKeyUsed } from '@/application/idempotencyService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { nowUTC } from '@/lib/date';
import { InsufficientStockError, NotFoundError, ValidationError } from '@/domain/errors';
import type { PaymentMethod, ProductRow, SaleItemInput, StockMovementType } from '@/domain/types';
import { type RecipeWithSupply } from '@/application/services/summaryService';
import { addItemToSummary } from '@/lib/summary-helpers';
import {
  collectStockProductIdsToLock,
  iterRecipeConsumptions,
  buildStockMovementReason,
} from '@/lib/stock-helpers';
import { lockCashRegisterById } from '@/lib/cash-register-helpers';
import {
  buildProductContext,
  buildReintegrationContext as buildReintegrationProductContext,
  validateProductsForOperation,
  validateCartAvailability,
  assertNoStockShortage,
} from '@/lib/product-helpers';
import { buildSaleItemValues } from '@/lib/sale-helpers';

export { validateCartAvailability } from '@/lib/product-helpers';

export { buildSaleItemValues } from '@/lib/sale-helpers';

export {
  calculateAvailability,
  calculateAvailabilityForProductIds,
} from '@/lib/product-helpers';

export type { ProductAvailability, RecipeBreakdownItem } from '@/lib/product-helpers';

async function updateCashRegisterSummary(
  tx: typeof db,
  cashRegister: (typeof cashRegisters.$inferSelect) | null,
  saleItems: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  paymentMethod: PaymentMethod,
  saleTotal: number,
  operation: 'add' | 'subtract'
) {
  if (!cashRegister) return;

  const sign = operation === 'add' ? 1 : -1;
  const saleMoney = parseMoney(sign * saleTotal);

  const total = moneyToNumber(addMoney(parseMoney(cashRegister.total), saleMoney));
  const cashTotal =
    paymentMethod === 'cash'
      ? moneyToNumber(addMoney(parseMoney(cashRegister.cashTotal), saleMoney))
      : cashRegister.cashTotal;
  const transferTotal =
    paymentMethod === 'transfer'
      ? moneyToNumber(addMoney(parseMoney(cashRegister.transferTotal), saleMoney))
      : cashRegister.transferTotal;
  const totalSales = cashRegister.totalSales + sign;

  const productsSummary: Record<string, number> =
    cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary: Record<string, number> =
    cashRegister.criticalSuppliesSummary ?? {};

  for (const item of saleItems) {
    const product = productById.get(item.productId);
    if (!product) continue;

    addItemToSummary(
      productsSummary,
      criticalSuppliesSummary,
      product,
      item.quantity,
      recipesByProduct,
      sign as 1 | -1
    );
  }

  await tx
    .update(cashRegisters)
    .set({
      total,
      cashTotal,
      transferTotal,
      totalSales,
      productsSummary,
      criticalSuppliesSummary,
    })
    .where(
      and(
        eq(cashRegisters.id, cashRegister.id),
        eq(cashRegisters.branchId, cashRegister.branchId)
      )
    );
}

async function deductStockForItems(
  tx: typeof db,
  branchId: number,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number },
  movementType: StockMovementType
) {
  const idsToLock = collectStockProductIdsToLock(
    items,
    productById,
    recipesByProduct
  );

  const reason = buildStockMovementReason(movementType, source.saleId);

  if (idsToLock.length > 0) {
    await tx
      .select()
      .from(products)
      .where(inArray(products.id, idsToLock))
      .for('update');
  }

  for (const item of items) {
    const product = productById.get(item.productId)!;

    if (product.type === 'compound') {
      for (const { supplyId, consumed, supplyName } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct
      )) {
        const [updated] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${consumed}` })
          .where(
            and(
              eq(products.id, supplyId),
              gte(products.stock, consumed)
            )
          )
          .returning({ id: products.id });

        if (!updated) {
          throw new InsufficientStockError(
            product.name,
            product.stock,
            consumed,
            supplyName
          );
        }

        await tx.insert(stockMovements).values({
          branchId,
          productId: supplyId,
          type: movementType,
          quantity: -consumed,
          saleId: source.saleId ?? null,
          reason,
          createdAt: nowUTC(),
        });
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(eq(products.id, product.id), gte(products.stock, item.quantity))
        )
        .returning({ id: products.id });

      if (!updated) {
        throw new InsufficientStockError(
          product.name,
          product.stock,
          item.quantity
        );
      }

      await tx.insert(stockMovements).values({
        branchId,
        productId: product.id,
        type: movementType,
        quantity: -item.quantity,
        saleId: source.saleId ?? null,
        reason,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service') {
      // Los servicios no generan movimientos de stock.
    }
  }
}

async function buildReintegrationContext(
  tx: typeof db,
  branchId: number,
  items: { productId: number }[],
  includeDeleted = false
): Promise<{
  productById: Map<number, ProductRow>;
  recipesByProduct: Map<number, RecipeWithSupply[]>;
}> {
  return buildReintegrationProductContext(tx, branchId, items, includeDeleted);
}

async function reintegrateStockAndUpdateCashRegister(
  tx: typeof db,
  branchId: number,
  cashRegister: { id: number; branchId: number } | null,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number },
  movementType: StockMovementType,
  paymentMethod?: PaymentMethod,
  total?: number,
  operation: 'add' | 'subtract' = 'subtract'
) {
  await reintegrateStockForItems(
    tx,
    branchId,
    items,
    productById,
    recipesByProduct,
    source,
    movementType
  );

  if (!cashRegister) return;

  if (paymentMethod === undefined || total === undefined) {
    throw new ValidationError(
      'Se requiere el método de pago y el total para actualizar la caja.'
    );
  }

  const lockedCashRegister = await lockCashRegisterById(
    tx,
    cashRegister.branchId,
    cashRegister.id
  );

  if (!lockedCashRegister) {
    throw new ValidationError('La caja asociada a la venta ya no existe.');
  }

  if (lockedCashRegister.status !== 'open' || lockedCashRegister.deletedAt) {
    throw new ValidationError(
      'La caja fue cerrada o eliminada mientras se anulaba la venta.'
    );
  }

  await updateCashRegisterSummary(
    tx,
    lockedCashRegister,
    items,
    productById,
    recipesByProduct,
    paymentMethod,
    total,
    operation
  );
}

async function reintegrateStockForItems(
  tx: typeof db,
  branchId: number,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number },
  movementType: StockMovementType
) {
  const idsToLock = collectStockProductIdsToLock(
    items,
    productById,
    recipesByProduct
  );

  const reason = buildStockMovementReason(movementType, source.saleId);

  if (idsToLock.length > 0) {
    await tx
      .select()
      .from(products)
      .where(inArray(products.id, idsToLock))
      .for('update');
  }

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      for (const { supplyId, consumed: reintegrated } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct
      )) {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${reintegrated}` })
          .where(eq(products.id, supplyId));

        await tx.insert(stockMovements).values({
          branchId,
          productId: supplyId,
          type: movementType,
          quantity: reintegrated,
          saleId: source.saleId ?? null,
          reason,
          createdAt: nowUTC(),
        });
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, product.id));

      await tx.insert(stockMovements).values({
        branchId,
        productId: product.id,
        type: movementType,
        quantity: item.quantity,
        saleId: source.saleId ?? null,
        reason,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service') {
      // Los servicios no reintegran stock al anularse.
    }
  }
}

export async function insertSaleAndUpdateCashRegister(
  tx: typeof db,
  branchId: number,
  cashRegister: (typeof cashRegisters.$inferSelect) | null,
  idempotencyKey: string,
  paymentMethod: PaymentMethod,
  total: number,
  saleItemValues: {
    productId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>
) {
  const [sale] = await tx
    .insert(sales)
    .values({
      branchId,
      total,
      paymentMethod,
      cashRegisterId: cashRegister?.id ?? null,
      idempotencyKey,
      createdAt: nowUTC(),
    })
    .returning();

  await tx.insert(saleItems).values(
    saleItemValues.map((item) => ({
      ...item,
      saleId: sale.id,
    }))
  );

  await deductStockForItems(
    tx,
    branchId,
    saleItemValues,
    productById,
    recipesByProduct,
    { saleId: sale.id },
    'sale'
  );

  const lockedCashRegister = await lockCashRegisterById(
    tx,
    branchId,
    cashRegister?.id ?? -1
  );

  if (!lockedCashRegister) {
    throw new ValidationError('La caja abierta ya no existe.');
  }

  if (lockedCashRegister.status !== 'open') {
    throw new ValidationError(
      'La caja fue cerrada mientras se procesaba la venta. Abrí una nueva caja para continuar.'
    );
  }

  await updateCashRegisterSummary(
    tx,
    lockedCashRegister,
    saleItemValues,
    productById,
    recipesByProduct,
    paymentMethod,
    total,
    'add'
  );

  return sale;
}

export async function confirmSale(params: {
  branchId: number;
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}) {
  const { branchId, items, paymentMethod, idempotencyKey } = params;

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  if (await isIdempotencyKeyUsed('sale', branchId, branchIdempotencyKey)) {
    throw new ValidationError('La venta ya fue procesada.');
  }

  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);

  if (!cashRegister) {
    throw new ValidationError(
      'No hay una caja abierta. Abrí la caja para comenzar a vender.'
    );
  }

  if (cashRegister.branchId !== branchId) {
    throw new ValidationError('La caja abierta no pertenece a la sucursal.');
  }

  return executeInTransaction(async (tx) => {
    const productIds = items.map((item) => item.productId);
    const { productById, recipesByProduct } = await buildProductContext(
      branchId,
      productIds,
      { dbOrTx: tx }
    );

    validateProductsForOperation(items, productById, branchId, 'venta');

    const { shortageByProduct } = await validateCartAvailability(
      branchId,
      items,
      undefined,
      tx
    );

    assertNoStockShortage(shortageByProduct, productById);

    const { saleItemValues, total: saleTotal } = buildSaleItemValues(
      productById,
      items
    );

    return insertSaleAndUpdateCashRegister(
      tx,
      branchId,
      cashRegister,
      branchIdempotencyKey,
      paymentMethod,
      saleTotal,
      saleItemValues,
      productById,
      recipesByProduct
    );
  });
}

export async function cancelSale(
  branchId: number,
  id: number,
  reason: string
) {
  const sale = (await db.query.sales.findFirst({
    where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
    with: {
      items: true,
      cashRegister: true,
    },
  })) as {
    id: number;
    branchId: number;
    total: number;
    paymentMethod: PaymentMethod;
    status: 'active' | 'cancelled';
    cashRegisterId: number | null;
    items: { productId: number; quantity: number }[];
    cashRegister: {
      id: number;
      branchId: number;
      total: number;
      cashTotal: number;
      transferTotal: number;
      totalSales: number;
      productsSummary: string | null;
      criticalSuppliesSummary: string | null;
      status: 'open' | 'closed';
      deletedAt: Date | null;
    } | null;
  } | undefined;

  if (!sale) throw new NotFoundError('Venta', id);
  if (sale.status === 'cancelled') return sale;

  if (
    !sale.cashRegister ||
    sale.cashRegister.status !== 'open' ||
    sale.cashRegister.deletedAt ||
    sale.cashRegister.branchId !== branchId
  ) {
    throw new ValidationError(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
  }

  return executeInTransaction(async (tx) => {
    const { productById, recipesByProduct } = await buildReintegrationContext(
      tx,
      branchId,
      sale.items ?? [],
      false
    );

    await reintegrateStockAndUpdateCashRegister(
      tx,
      branchId,
      sale.cashRegister,
      sale.items ?? [],
      productById,
      recipesByProduct,
      { saleId: sale.id },
      'cancellation',
      sale.paymentMethod,
      sale.total,
      'subtract'
    );

    const [updated] = await tx
      .update(sales)
      .set({
        status: 'cancelled',
        cancelledAt: nowUTC(),
        cancellationReason: reason,
      })
      .where(and(eq(sales.id, id), eq(sales.branchId, branchId)))
      .returning();

    return updated;
  });
}
