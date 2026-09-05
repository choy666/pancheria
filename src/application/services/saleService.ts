import { eq, sql, and, inArray, gte, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  cashRegisters,
  products,
  sales,
  saleItems,
  saleItemRecipes,
  salePayments,
  stockMovements,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as idempotencyService from '@/application/idempotencyService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { nowUTC } from '@/lib/date';
import { InsufficientStockError, NotFoundError, ValidationError } from '@/domain/errors';
import type {
  PaymentPart,
  ProductRow,
  ProductType,
  SaleItemInput,
  StockMovementType,
} from '@/domain/types';

import { type RecipeWithSupply } from '@/lib/recipe-helpers';
import { addItemToSummary } from '@/lib/summary-helpers';
import {
  collectStockProductIdsToLock,
  iterRecipeConsumptions,
  buildStockMovementReason,
} from '@/lib/stock-helpers';
import { lockCashRegisterById } from '@/lib/cash-register-helpers';
import { buildProductContext } from '@/lib/product-helpers';
import { type SaleItemValue } from '@/lib/sale-helpers';
import { prepareCart } from '@/lib/cart-pipeline';
import {
  sumPaymentParts,
  amountByPaymentMethod,
  validatePaymentParts,
} from '@/lib/payment-helpers';

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
  saleItems: SaleItemValue[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  payments: PaymentPart[],
  saleTotal: number,
  operation: 'add' | 'subtract'
) {
  if (!cashRegister) return;

  const sign = operation === 'add' ? 1 : -1;
  const saleMoney = parseMoney(sign * saleTotal);
  const amounts = amountByPaymentMethod(payments);
  const cashMoney = parseMoney(sign * amounts.cash);
  const transferMoney = parseMoney(sign * amounts.transfer);

  const total = moneyToNumber(addMoney(parseMoney(cashRegister.total), saleMoney));
  const cashTotal = moneyToNumber(
    addMoney(parseMoney(cashRegister.cashTotal), cashMoney)
  );
  const transferTotal = moneyToNumber(
    addMoney(parseMoney(cashRegister.transferTotal), transferMoney)
  );
  const totalSales = cashRegister.totalSales + sign;

  const productsSummary: Record<string, number> =
    cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary: Record<string, number> =
    cashRegister.criticalSuppliesSummary ?? {};
  const recipeSuppliesSummary: Record<string, number> =
    cashRegister.recipeSuppliesSummary ?? {};

  for (const item of saleItems) {
    const product = productById.get(item.productId);
    if (!product) continue;

    addItemToSummary(
      productsSummary,
      criticalSuppliesSummary,
      recipeSuppliesSummary,
      product,
      item.quantity,
      recipesByProduct,
      item.recipeSnapshot,
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
      recipeSuppliesSummary,
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
  items: SaleItemValue[],
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
      .orderBy(asc(products.id))
      .for('update');
  }

  for (const item of items) {
    const product = productById.get(item.productId)!;

    if (product.type === 'compound') {
      const recipeSnapshot = item.recipeSnapshot ?? [];
      for (const { supplyId, consumed, supplyName } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct,
        recipeSnapshot
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
          orderId: null,
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
        orderId: null,
        reason,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service' || product.type === 'manual_supply') {
      // Los servicios y los insumos manuales no generan movimientos de stock
      // automáticos. Los insumos manuales se controlan fuera del flujo de venta.
    }
  }
}

async function reintegrateStockAndUpdateCashRegister(
  tx: typeof db,
  branchId: number,
  cashRegister: { id: number; branchId: number } | null,
  items: SaleItemValue[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number },
  movementType: StockMovementType,
  payments?: PaymentPart[],
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

  if (payments === undefined || payments.length === 0 || total === undefined) {
    throw new ValidationError(
      'Se requiere el desglose de pagos y el total para actualizar la caja.'
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
    payments,
    total,
    operation
  );
}

async function reintegrateStockForItems(
  tx: typeof db,
  branchId: number,
  items: SaleItemValue[],
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
      .orderBy(asc(products.id))
      .for('update');
  }

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
          orderId: null,
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
        orderId: null,
        reason,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service' || product.type === 'manual_supply') {
      // Los servicios y los insumos manuales no reintegran stock al anularse.
    }
  }
}

export async function insertSaleAndUpdateCashRegister(
  tx: typeof db,
  branchId: number,
  cashRegister: (typeof cashRegisters.$inferSelect) | null,
  idempotencyKey: string,
  payments: PaymentPart[],
  saleItemValues: SaleItemValue[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>
) {
  const total = sumPaymentParts(payments);
  const primaryPaymentMethod = payments[0]?.method ?? 'cash';

  const [sale] = await tx
    .insert(sales)
    .values({
      branchId,
      total,
      paymentMethod: primaryPaymentMethod,
      cashRegisterId: cashRegister?.id ?? null,
      idempotencyKey,
      createdAt: nowUTC(),
    })
    .onConflictDoNothing()
    .returning();

  if (!sale) {
    const existing = await idempotencyService.findExistingByIdempotencyKey(
      'sale',
      branchId,
      idempotencyKey,
      tx
    );
    if (!existing) {
      throw new Error('No se pudo crear ni recuperar la venta.');
    }
    return existing;
  }

  const insertedSaleItems = await tx
    .insert(saleItems)
    .values(
      saleItemValues.map((item) => ({
        ...item,
        saleId: sale.id,
      }))
    )
    .returning();

  const recipeRows: (typeof saleItemRecipes.$inferInsert)[] = [];
  for (let i = 0; i < insertedSaleItems.length; i++) {
    const saleItem = insertedSaleItems[i];
    const snapshot = saleItemValues[i].recipeSnapshot ?? [];
    for (const config of snapshot) {
      recipeRows.push({
        saleItemId: saleItem.id,
        supplyId: config.supplyId,
        supplyName: config.supplyName,
        supplyType: config.supplyType,
        quantity: config.quantity,
        autoDiscount: config.autoDiscount,
        isOptional: config.isOptional,
        selected: config.selected,
        selectedByDefault: config.selectedByDefault,
      });
    }
  }

  if (recipeRows.length > 0) {
    await tx.insert(saleItemRecipes).values(recipeRows);
  }

  if (payments.length > 0) {
    await tx.insert(salePayments).values(
      payments.map((payment) => ({
        saleId: sale.id,
        method: payment.method,
        amount: payment.amount,
        createdAt: nowUTC(),
      }))
    );
  }

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
    payments,
    total,
    'add'
  );

  return sale;
}

export async function confirmSale(params: {
  branchId: number;
  items: SaleItemInput[];
  payments: PaymentPart[];
  idempotencyKey: string;
}) {
  const { branchId, items, payments, idempotencyKey } = params;

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

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
    const existingSale = await idempotencyService.findExistingByIdempotencyKey(
      'sale',
      branchId,
      branchIdempotencyKey,
      tx
    );
    if (existingSale) {
      throw new ValidationError('La venta ya fue procesada.');
    }

    const {
      productById,
      recipesByProduct,
      saleItemValues,
      total: saleTotal,
    } = await prepareCart({
      branchId,
      items,
      operation: 'venta',
      dbOrTx: tx,
      options: { shouldLock: true },
    });

    const paymentValidation = validatePaymentParts(payments, saleTotal);
    if (!paymentValidation.valid) {
      throw new ValidationError(paymentValidation.error ?? 'Pago inválido.');
    }

    return insertSaleAndUpdateCashRegister(
      tx,
      branchId,
      cashRegister,
      branchIdempotencyKey,
      payments,
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
  return executeInTransaction(async (tx) => {
    const sale = (await tx.query.sales.findFirst({
      where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
      with: {
        items: { with: { product: true, recipeSnapshots: true } },
        payments: true,
        cashRegister: true,
      },
    })) as {
      id: number;
      branchId: number;
      total: number;
      paymentMethod: 'cash' | 'transfer';
      status: 'active' | 'cancelled';
      cashRegisterId: number | null;
      items: {
        productId: number;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        product: { name: string } | null;
        recipeSnapshots: {
          supplyId: number;
          supplyName: string;
          supplyType: ProductType;
          quantity: number;
          autoDiscount: boolean;
          isOptional: boolean;
          selected: boolean;
          selectedByDefault: boolean;
        }[];
      }[];
      payments: PaymentPart[];
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

    const payments = sale.payments ?? [];

    const saleItemValues: SaleItemValue[] = sale.items.map((item) => ({
      productId: item.productId,
      productName: item.product?.name ?? `Producto ${item.productId}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      recipeSnapshot: item.recipeSnapshots
        ? item.recipeSnapshots.map((s) => ({
            supplyId: s.supplyId,
            supplyName: s.supplyName,
            supplyType: s.supplyType,
            quantity: s.quantity,
            autoDiscount: s.autoDiscount,
            isOptional: s.isOptional,
            selected: s.selected,
            selectedByDefault: s.selectedByDefault,
          }))
        : undefined,
    }));

    const [locked] = await tx
      .update(sales)
      .set({
        status: 'cancelled',
        cancelledAt: nowUTC(),
        cancellationReason: reason,
      })
      .where(
        and(
          eq(sales.id, id),
          eq(sales.branchId, branchId),
          eq(sales.status, 'active')
        )
      )
      .returning();

    if (!locked) {
      const current = await tx.query.sales.findFirst({
        where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
      });
      if (current?.status === 'cancelled') {
        return current;
      }
      throw new NotFoundError('Venta', id);
    }

    const { productById, recipesByProduct } = await buildProductContext(
      branchId,
      saleItemValues.map((item) => item.productId),
      { dbOrTx: tx }
    );

    await reintegrateStockAndUpdateCashRegister(
      tx,
      branchId,
      sale.cashRegister,
      saleItemValues,
      productById,
      recipesByProduct,
      { saleId: sale.id },
      'cancellation',
      payments,
      sale.total,
      'subtract'
    );

    return locked;
  });
}
