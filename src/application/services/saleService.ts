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
import * as productRepository from '@/repositories/productRepository';
import {
  addMoney,
  multiplyMoney,
  moneyToNumber,
  parseMoney,
} from '@/lib/money';
import { nowUTC } from '@/lib/date';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';
import type {
  PaymentMethod,
  ProductRow,
  SaleItemInput,
  StockMovementType,
} from '@/domain/types';
import {
  calculateCompoundAvailability,
  findRecipesForProducts,
  groupRecipesByProduct,
  type RecipeWithSupply,
} from '@/application/services/summaryService';

export interface RecipeBreakdownItem {
  supplyName: string;
  available: number;
  required: number;
  isLimiting: boolean;
}


export async function calculateAvailability(
  branchId: number,
  productId: number
): Promise<number> {
  const result = await calculateAvailabilityForProductIds(branchId, [productId]);
  return result[productId]?.availability ?? 0;
}

export interface ProductAvailability {
  availability: number;
  breakdown: RecipeBreakdownItem[];
}

interface AvailabilityContext {
  productsList: ProductRow[];
  productById: Map<number, ProductRow>;
  recipesByProduct: Map<number, RecipeWithSupply[]>;
  supplyStockById: Record<number, number>;
  supplyNameById: Record<number, string>;
}

async function buildAvailabilityContext(
  branchId: number,
  productIds: number[]
): Promise<AvailabilityContext> {
  const productsList = await productRepository.findByIds(branchId, productIds);
  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();
  const supplyStockById: Record<number, number> = {};
  const supplyNameById: Record<number, string> = {};

  for (const product of productsList) {
    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      supplyStockById[product.id] = product.stock;
      supplyNameById[product.id] = product.name;
    }
  }

  if (compoundProductIds.length > 0) {
    const allRecipes = await findRecipesForProducts(branchId, compoundProductIds);

    for (const recipeItem of allRecipes) {
      if (recipeItem.autoDiscount) {
        supplyStockById[recipeItem.supplyId] =
          recipeItem.supply?.stock ?? 0;
        supplyNameById[recipeItem.supplyId] =
          recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
      }
    }

    groupRecipesByProduct(allRecipes).forEach((value, key) => {
      recipesByProduct.set(key, value);
    });
  }

  return {
    productsList,
    productById,
    recipesByProduct,
    supplyStockById,
    supplyNameById,
  };
}

function buildBreakdown(
  criticalItems: RecipeWithSupply[],
  supplyStockById: Record<number, number>,
  supplyNameById: Record<number, string>,
  consumedBySupply: Record<number, number> = {}
): RecipeBreakdownItem[] {
  let bottleneck: { supplyId: number; capacity: number } | null = null;
  let minCapacity = Infinity;

  for (const recipeItem of criticalItems) {
    const stock = supplyStockById[recipeItem.supplyId] ?? 0;
    const consumed = consumedBySupply[recipeItem.supplyId] ?? 0;
    const capacity = Math.floor(
      Math.max(0, stock - consumed) / recipeItem.quantity
    );
    if (capacity < minCapacity) {
      minCapacity = capacity;
      bottleneck = { supplyId: recipeItem.supplyId, capacity };
    }
  }

  return criticalItems.map((recipeItem) => {
    const stock = supplyStockById[recipeItem.supplyId] ?? 0;
    const consumed = consumedBySupply[recipeItem.supplyId] ?? 0;
    return {
      supplyName:
        supplyNameById[recipeItem.supplyId] ??
        `Insumo ${recipeItem.supplyId}`,
      available: Math.max(0, stock - consumed),
      required: recipeItem.quantity,
      isLimiting: bottleneck?.supplyId === recipeItem.supplyId,
    };
  });
}

export async function calculateAvailabilityForProductIds(
  branchId: number,
  productIds: number[]
): Promise<Record<number, ProductAvailability>> {
  if (productIds.length === 0) return {};

  const { productById, recipesByProduct, supplyStockById, supplyNameById } =
    await buildAvailabilityContext(branchId, productIds);

  const resultById: Record<number, ProductAvailability> = {};

  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) {
      resultById[productId] = { availability: 0, breakdown: [] };
      continue;
    }

    if (product.type === 'compound') {
      const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
        (r) => r.autoDiscount
      );
      const breakdown = buildBreakdown(
        criticalItems,
        supplyStockById,
        supplyNameById
      );

      resultById[product.id] = {
        availability: calculateCompoundAvailability(
          recipesByProduct.get(product.id) ?? []
        ),
        breakdown,
      };
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      resultById[product.id] = {
        availability: product.stock,
        breakdown: [],
      };
    } else if (product.type === 'service') {
      resultById[product.id] = {
        availability: Number.MAX_SAFE_INTEGER,
        breakdown: [],
      };
    } else {
      resultById[product.id] = { availability: 0, breakdown: [] };
    }
  }

  return resultById;
}

export async function validateCartAvailability(
  branchId: number,
  items: SaleItemInput[],
  productIds?: number[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  consumedBySupply: Record<number, number>;
  shortageByProduct: Record<number, { available: number; required: number; supplyName: string }>;
  breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
}> {
  const itemProductIds = items.map((item) => item.productId);
  const allProductIds = Array.from(
    new Set([...itemProductIds, ...(productIds ?? [])])
  );

  const {
    productsList,
    productById,
    recipesByProduct,
    supplyStockById,
    supplyNameById,
  } = await buildAvailabilityContext(branchId, allProductIds);

  for (const item of items) {
    if (!productById.has(item.productId)) {
      throw new NotFoundError('Producto', item.productId);
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
      availabilityByProduct[productId] = calculateCompoundAvailability(
        recipesByProduct.get(product.id) ?? [],
        supplyStockById,
        consumedBySupply
      );
    } else {
      availabilityByProduct[productId] = 0;
    }
  }

  const shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  > = {};

  const breakdownByProduct: Record<number, RecipeBreakdownItem[]> = {};

  for (const product of productsList) {
    if (product.type !== 'compound') continue;

    const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
      (r) => r.autoDiscount
    );

    breakdownByProduct[product.id] = buildBreakdown(
      criticalItems,
      supplyStockById,
      supplyNameById,
      consumedBySupply
    );
  }

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

  return { availabilityByProduct, consumedBySupply, shortageByProduct, breakdownByProduct };
}

export async function updateCashRegisterSummary(
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

  const productsSummary: Record<string, number> =
    cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary: Record<string, number> =
    cashRegister.criticalSuppliesSummary ?? {};

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

export async function deductStockForItems(
  tx: typeof db,
  branchId: number,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number; orderId?: number },
  movementType: StockMovementType
) {
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

  const idsToLock = Array.from(productIdsToLock);
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
      const recipeList = recipesByProduct.get(product.id) ?? [];

      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;

        const consumed = recipeItem.quantity * item.quantity;

        const [updated] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${consumed}` })
          .where(
            and(
              eq(products.id, recipeItem.supplyId),
              gte(products.stock, consumed)
            )
          )
          .returning({ id: products.id });

        if (!updated) {
          throw new InsufficientStockError(
            product.name,
            product.stock,
            consumed,
            recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`
          );
        }

        await tx.insert(stockMovements).values({
          branchId,
          productId: recipeItem.supplyId,
          type: movementType,
          quantity: -consumed,
          saleId: source.saleId ?? null,
          orderId: source.orderId ?? null,
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
        orderId: source.orderId ?? null,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service') {
      // Los servicios no generan movimientos de stock.
    }
  }
}

export async function reintegrateStockForItems(
  tx: typeof db,
  branchId: number,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  source: { saleId?: number; orderId?: number },
  movementType: StockMovementType
) {
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

  const idsToLock = Array.from(productIdsToLock);
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
      const recipeList = recipesByProduct.get(product.id) ?? [];

      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;

        const reintegrated = recipeItem.quantity * item.quantity;

        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${reintegrated}` })
          .where(eq(products.id, recipeItem.supplyId));

        await tx.insert(stockMovements).values({
          branchId,
          productId: recipeItem.supplyId,
          type: movementType,
          quantity: reintegrated,
          saleId: source.saleId ?? null,
          orderId: source.orderId ?? null,
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
        orderId: source.orderId ?? null,
        createdAt: nowUTC(),
      });
    } else if (product.type === 'service') {
      // Los servicios no reintegran stock al anularse.
    }
  }
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

  const productIds = items.map((item) => item.productId);
  const productsList = await productRepository.findByIds(branchId, productIds);

  if (productsList.length !== productIds.length) {
    throw new NotFoundError('Producto');
  }

  const productById = new Map(productsList.map((p) => [p.id, p]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new NotFoundError('Producto', item.productId);

    if (product.branchId !== branchId) {
      throw new ValidationError(
        `El producto ${product.name} no pertenece a la sucursal.`
      );
    }

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

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  let recipesByProduct = new Map<number, RecipeWithSupply[]>();
  if (compoundProductIds.length > 0) {
    const allRecipes = await findRecipesForProducts(
      branchId,
      compoundProductIds
    );

    recipesByProduct = groupRecipesByProduct(allRecipes);
  }

  const { shortageByProduct } = await validateCartAvailability(branchId, items);

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
        branchId,
        total: moneyToNumber(saleTotal),
        paymentMethod,
        cashRegisterId: cashRegister.id,
        idempotencyKey: branchIdempotencyKey,
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

    const [lockedCashRegister] = await tx
      .select()
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.id, cashRegister.id),
          eq(cashRegisters.branchId, branchId)
        )
      )
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
    const productIds = (sale.items ?? []).map((item) => item.productId);
    const productsList =
      productIds.length > 0 ? await productRepository.findByIds(branchId, productIds) : [];
    const productById = new Map(productsList.map((p) => [p.id, p]));

    const compoundProductIds = productsList
      .filter((p) => p.type === 'compound')
      .map((p) => p.id);

    let recipesByProduct = new Map<number, RecipeWithSupply[]>();
    if (compoundProductIds.length > 0) {
      const allRecipes = await findRecipesForProducts(
        branchId,
        compoundProductIds,
        tx
      );

      recipesByProduct = groupRecipesByProduct(allRecipes);
    }

    await reintegrateStockForItems(
      tx,
      branchId,
      sale.items ?? [],
      productById,
      recipesByProduct,
      { saleId: sale.id },
      'cancellation'
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

    const [lockedCashRegister] = await tx
      .select()
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.id, sale.cashRegister!.id),
          eq(cashRegisters.branchId, branchId)
        )
      )
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
