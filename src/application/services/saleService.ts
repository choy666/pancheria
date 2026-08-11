import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  cashRegisters,
  products,
  recipes,
  sales,
  saleItems,
  stockMovements,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import { isIdempotencyKeyUsed } from '@/application/idempotencyService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as productRepository from '@/repositories/productRepository';
import {
  addMoney,
  multiplyMoney,
  moneyToNumber,
  parseMoney,
} from '@/lib/money';
import { nowUTC } from '@/lib/date';
import { safeJsonParse } from '@/lib/json';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';
import type { PaymentMethod, ProductRow, SaleItemInput } from '@/domain/types';

type RecipeWithSupply = typeof recipes.$inferSelect & {
  supply: ProductRow | null;
};

export async function calculateAvailability(productId: number): Promise<number> {
  const product = await productRepository.findById(productId);
  if (!product) return 0;

  if (product.type === 'compound') {
    const recipe = await db.query.recipes.findMany({
      where: eq(recipes.compoundProductId, productId),
      with: { supply: true },
    });

    const criticalItems = recipe.filter((r) => r.autoDiscount);
    if (criticalItems.length === 0) return 0;

    return Math.min(
      ...criticalItems.map((r) =>
        Math.floor((r.supply?.stock ?? 0) / r.quantity)
      )
    );
  }

  if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    return product.stock;
  }

  if (product.type === 'service') {
    return Number.MAX_SAFE_INTEGER;
  }

  return 0;
}

export async function calculateAvailabilityForProductIds(
  productIds: number[]
): Promise<Record<number, number>> {
  if (productIds.length === 0) return {};

  const productsList = await productRepository.findByIds(productIds);
  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();

  if (compoundProductIds.length > 0) {
    const allRecipes = (await db.query.recipes.findMany({
      where: inArray(recipes.compoundProductId, compoundProductIds),
      with: { supply: true },
    })) as RecipeWithSupply[];

    for (const recipeItem of allRecipes) {
      if (!recipesByProduct.has(recipeItem.compoundProductId)) {
        recipesByProduct.set(recipeItem.compoundProductId, []);
      }
      recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
    }
  }

  const availabilityById: Record<number, number> = {};

  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) {
      availabilityById[productId] = 0;
      continue;
    }

    if (product.type === 'compound') {
      const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
        (r) => r.autoDiscount
      );
      if (criticalItems.length === 0) {
        availabilityById[product.id] = 0;
      } else {
        availabilityById[product.id] = Math.min(
          ...criticalItems.map((r) =>
            Math.floor((r.supply?.stock ?? 0) / r.quantity)
          )
        );
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      availabilityById[product.id] = product.stock;
    } else if (product.type === 'service') {
      availabilityById[product.id] = Number.MAX_SAFE_INTEGER;
    } else {
      availabilityById[product.id] = 0;
    }
  }

  return availabilityById;
}

export async function validateCartAvailability(
  items: SaleItemInput[],
  productIds?: number[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  consumedBySupply: Record<number, number>;
  shortageByProduct: Record<number, { available: number; required: number; supplyName: string }>;
}> {
  const itemProductIds = items.map((item) => item.productId);
  const allProductIds = Array.from(
    new Set([...itemProductIds, ...(productIds ?? [])])
  );

  const productsList = await productRepository.findByIds(allProductIds);
  const productById = new Map(productsList.map((p) => [p.id, p]));

  for (const item of items) {
    if (!productById.has(item.productId)) {
      throw new NotFoundError('Producto', item.productId);
    }
  }

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();
  const supplyStockById: Record<number, number> = {};
  const supplyNameById: Record<number, string> = {};

  if (compoundProductIds.length > 0) {
    const allRecipes = (await db.query.recipes.findMany({
      where: inArray(recipes.compoundProductId, compoundProductIds),
      with: { supply: true },
    })) as RecipeWithSupply[];

    for (const recipeItem of allRecipes) {
      if (!recipesByProduct.has(recipeItem.compoundProductId)) {
        recipesByProduct.set(recipeItem.compoundProductId, []);
      }
      recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);

      if (recipeItem.autoDiscount) {
        supplyStockById[recipeItem.supplyId] = recipeItem.supply?.stock ?? 0;
        supplyNameById[recipeItem.supplyId] =
          recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
      }
    }
  }

  for (const product of productsList) {
    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      supplyStockById[product.id] = product.stock;
      supplyNameById[product.id] = product.name;
    }
  }

  const consumedBySupply: Record<number, number> = {};

  for (const item of items) {
    const product = productById.get(item.productId)!;
    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;
        consumedBySupply[recipeItem.supplyId] =
          (consumedBySupply[recipeItem.supplyId] ?? 0) +
          item.quantity * recipeItem.quantity;
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      consumedBySupply[product.id] =
        (consumedBySupply[product.id] ?? 0) + item.quantity;
    }
  }

  const availabilityByProduct: Record<number, number> = {};
  const targetProductIds =
    allProductIds.length > 0 ? allProductIds : itemProductIds;

  for (const productId of targetProductIds) {
    const product = productById.get(productId);
    if (!product) {
      availabilityByProduct[productId] = 0;
      continue;
    }

    if (product.type === 'service') {
      availabilityByProduct[productId] = Number.MAX_SAFE_INTEGER;
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      availabilityByProduct[productId] =
        (supplyStockById[product.id] ?? 0) -
        (consumedBySupply[product.id] ?? 0);
    } else if (product.type === 'compound') {
      const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
        (r) => r.autoDiscount
      );
      if (criticalItems.length === 0) {
        availabilityByProduct[productId] = 0;
      } else {
        availabilityByProduct[productId] = Math.min(
          ...criticalItems.map((r) => {
            const stockRemaining =
              (supplyStockById[r.supplyId] ?? 0) -
              (consumedBySupply[r.supplyId] ?? 0);
            return Math.floor(stockRemaining / r.quantity);
          })
        );
      }
    } else {
      availabilityByProduct[productId] = 0;
    }
  }

  const shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  > = {};

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || product.type === 'service') continue;

    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      const available = supplyStockById[product.id] ?? 0;
      const required = consumedBySupply[product.id] ?? 0;
      if (required > available) {
        shortageByProduct[product.id] = {
          available,
          required,
          supplyName: supplyNameById[product.id] ?? product.name,
        };
      }
    } else if (product.type === 'compound') {
      const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
        (r) => r.autoDiscount
      );
      let bottleneck: { available: number; required: number; supplyName: string } | null = null;
      let minCapacity = Infinity;

      for (const recipeItem of criticalItems) {
        const available = supplyStockById[recipeItem.supplyId] ?? 0;
        const required = consumedBySupply[recipeItem.supplyId] ?? 0;
        const capacity = Math.floor(
          (available - required) / recipeItem.quantity
        );
        if (capacity < minCapacity) {
          minCapacity = capacity;
          bottleneck = {
            available,
            required,
            supplyName:
              supplyNameById[recipeItem.supplyId] ??
              `Insumo ${recipeItem.supplyId}`,
          };
        }
      }

      if (minCapacity < 0 && bottleneck) {
        shortageByProduct[product.id] = bottleneck;
      }
    }
  }

  return { availabilityByProduct, consumedBySupply, shortageByProduct };
}

async function updateCashRegisterSummary(
  tx: typeof db,
  cashRegister: {
    id: number;
    total: number;
    cashTotal: number;
    transferTotal: number;
    totalSales: number;
    productsSummary: string | null;
    criticalSuppliesSummary: string | null;
  } | null,
  saleItems: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  paymentMethod: PaymentMethod,
  saleTotal: number,
  operation: 'add' | 'subtract'
) {
  if (!cashRegister || typeof cashRegister.productsSummary !== 'string') return;

  const sign = operation === 'add' ? 1 : -1;
  const saleMoney = parseMoney(sign * saleTotal);

  const total = moneyToNumber(
    addMoney(parseMoney(cashRegister.total), saleMoney)
  );
  const cashTotal =
    paymentMethod === 'cash'
      ? moneyToNumber(
          addMoney(parseMoney(cashRegister.cashTotal), saleMoney)
        )
      : cashRegister.cashTotal;
  const transferTotal =
    paymentMethod === 'transfer'
      ? moneyToNumber(
          addMoney(parseMoney(cashRegister.transferTotal), saleMoney)
        )
      : cashRegister.transferTotal;
  const totalSales = cashRegister.totalSales + sign;

  const productsSummary = safeJsonParse<Record<string, number>>(
    cashRegister.productsSummary,
    {}
  );
  const criticalSuppliesSummary = safeJsonParse<Record<string, number>>(
    cashRegister.criticalSuppliesSummary,
    {}
  );

  for (const item of saleItems) {
    const product = productById.get(item.productId);
    if (!product) continue;

    productsSummary[product.name] =
      (productsSummary[product.name] ?? 0) + sign * item.quantity;

    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      criticalSuppliesSummary[product.name] =
        (criticalSuppliesSummary[product.name] ?? 0) +
        sign * item.quantity;
    }

    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;

        const consumed = recipeItem.quantity * item.quantity;
        const supplyName = recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
        criticalSuppliesSummary[supplyName] =
          (criticalSuppliesSummary[supplyName] ?? 0) + sign * consumed;
      }
    }
  }

  await tx
    .update(cashRegisters)
    .set({
      total,
      cashTotal,
      transferTotal,
      totalSales,
      productsSummary: JSON.stringify(productsSummary),
      criticalSuppliesSummary: JSON.stringify(criticalSuppliesSummary),
    })
    .where(eq(cashRegisters.id, cashRegister.id));
}

export async function confirmSale(params: {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}) {
  const { items, paymentMethod, idempotencyKey } = params;

  if (await isIdempotencyKeyUsed(idempotencyKey)) {
    throw new ValidationError('La venta ya fue procesada.');
  }

  const cashRegister = await cashRegisterService.getOpenCashRegister();

  if (!cashRegister) {
    throw new ValidationError(
      'No hay una caja abierta. Abrí la caja para comenzar a vender.'
    );
  }

  const productIds = items.map((item) => item.productId);
  const productsList = await productRepository.findByIds(productIds);

  if (productsList.length !== productIds.length) {
    throw new NotFoundError('Producto');
  }

  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();
  if (compoundProductIds.length > 0) {
    const allRecipes = (await db.query.recipes.findMany({
      where: inArray(recipes.compoundProductId, compoundProductIds),
      with: { supply: true },
    })) as RecipeWithSupply[];

    for (const recipeItem of allRecipes) {
      if (!recipesByProduct.has(recipeItem.compoundProductId)) {
        recipesByProduct.set(recipeItem.compoundProductId, []);
      }
      recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
    }
  }

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new NotFoundError('Producto', item.productId);

    if (!product.isActive) {
      throw new ValidationError(`El producto ${product.name} no está activo.`);
    }

    const isSellable =
      product.type === 'compound' ||
      product.type === 'service' ||
      (product.type === 'critical_supply' &&
        product.criticalSupplyType === 'beverage');

    if (!isSellable) {
      throw new ValidationError(
        `El producto ${product.name} no está disponible para la venta.`
      );
    }
  }

  const { shortageByProduct } = await validateCartAvailability(items);

  if (Object.keys(shortageByProduct).length > 0) {
    const productId = Number(Object.keys(shortageByProduct)[0]);
    const product = productById.get(productId)!;
    const shortage = shortageByProduct[productId];
    throw new InsufficientStockError(
      product.name,
      shortage.available,
      shortage.required,
      shortage.supplyName !== product.name ? shortage.supplyName : undefined
    );
  }

  return executeInTransaction(async (tx) => {
    let saleTotal = parseMoney(0);
    const saleItemValues: {
      productId: number;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const product = productById.get(item.productId)!;
      const unitPrice = parseMoney(product.price);
      const subtotal = multiplyMoney(unitPrice, item.quantity);
      saleTotal = addMoney(saleTotal, subtotal);

      saleItemValues.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: moneyToNumber(subtotal),
      });
    }

    const [sale] = await tx
      .insert(sales)
      .values({
        total: moneyToNumber(saleTotal),
        paymentMethod,
        cashRegisterId: cashRegister.id,
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

    for (const item of saleItemValues) {
      const product = productById.get(item.productId)!;

      if (product.type === 'compound') {
        const recipeList = recipesByProduct.get(product.id) ?? [];

        for (const recipeItem of recipeList) {
          if (!recipeItem.autoDiscount) continue;

          const consumed = recipeItem.quantity * item.quantity;

          await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${consumed}` })
            .where(eq(products.id, recipeItem.supplyId));

          await tx.insert(stockMovements).values({
            productId: recipeItem.supplyId,
            type: 'sale',
            quantity: -consumed,
            saleId: sale.id,
            createdAt: nowUTC(),
          });
        }
      } else if (
        product.type === 'critical_supply' &&
        product.criticalSupplyType === 'beverage'
      ) {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(eq(products.id, product.id));

        await tx.insert(stockMovements).values({
          productId: product.id,
          type: 'sale',
          quantity: -item.quantity,
          saleId: sale.id,
          createdAt: nowUTC(),
        });
      } else if (product.type === 'service') {
        // Los servicios no generan movimientos de stock.
      }
    }

    const [lockedCashRegister] = await tx
      .select()
      .from(cashRegisters)
      .where(eq(cashRegisters.id, cashRegister.id))
      .for('update');

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
      moneyToNumber(saleTotal),
      'add'
    );

    return sale;
  });
}

export async function cancelSale(id: number, reason: string) {
  const sale = (await db.query.sales.findFirst({
    where: eq(sales.id, id),
    with: {
      items: true,
      cashRegister: true,
    },
  })) as {
    id: number;
    total: number;
    paymentMethod: PaymentMethod;
    status: 'active' | 'cancelled';
    cashRegisterId: number | null;
    items: { productId: number; quantity: number }[];
    cashRegister: {
      id: number;
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
    sale.cashRegister.deletedAt
  ) {
    throw new ValidationError(
      'No se puede anular una venta de una caja cerrada o eliminada.'
    );
  }

  return executeInTransaction(async (tx) => {
    const productIds = (sale.items ?? []).map((item) => item.productId);
    const productsList =
      productIds.length > 0 ? await productRepository.findByIds(productIds) : [];
    const productById = new Map(productsList.map((p) => [p.id, p]));

    const compoundProductIds = productsList
      .filter((p) => p.type === 'compound')
      .map((p) => p.id);

    const recipesByProduct = new Map<number, RecipeWithSupply[]>();
    if (compoundProductIds.length > 0) {
      const allRecipes = (await tx.query.recipes.findMany({
        where: inArray(recipes.compoundProductId, compoundProductIds),
        with: { supply: true },
      })) as RecipeWithSupply[];

      for (const recipeItem of allRecipes) {
        if (!recipesByProduct.has(recipeItem.compoundProductId)) {
          recipesByProduct.set(recipeItem.compoundProductId, []);
        }
        recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
      }
    }

    for (const item of sale.items ?? []) {
      const product = productById.get(item.productId);
      if (!product) continue;

      if (product.type === 'compound') {
        const recipeList = recipesByProduct.get(product.id) ?? [];

        for (const recipeItem of recipeList) {
          if (!recipeItem.autoDiscount) continue;

          const reintegrated = recipeItem.quantity * item.quantity;

          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${reintegrated}` })
            .where(eq(products.id, recipeItem.supplyId));

          await tx.insert(stockMovements).values({
            productId: recipeItem.supplyId,
            type: 'cancellation',
            quantity: reintegrated,
            saleId: sale.id,
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
          productId: product.id,
          type: 'cancellation',
          quantity: item.quantity,
          saleId: sale.id,
          createdAt: nowUTC(),
        });
      } else if (product.type === 'service') {
        // Los servicios no reintegran stock al anularse.
      }
    }

    const [updated] = await tx
      .update(sales)
      .set({
        status: 'cancelled',
        cancelledAt: nowUTC(),
        cancellationReason: reason,
      })
      .where(eq(sales.id, id))
      .returning();

    const [lockedCashRegister] = await tx
      .select()
      .from(cashRegisters)
      .where(eq(cashRegisters.id, sale.cashRegister!.id))
      .for('update');

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
      sale.items ?? [],
      productById,
      recipesByProduct,
      sale.paymentMethod,
      sale.total,
      'subtract'
    );

    return updated;
  });
}
