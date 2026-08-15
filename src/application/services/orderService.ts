import { eq, and, isNull, count } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'crypto';
import { db } from '@/db';
import {
  orders,
  orderItems,
  sales,
  saleItems,
  cashRegisters,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as productRepository from '@/repositories/productRepository';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';
import {
  addMoney,
  multiplyMoney,
  moneyToNumber,
  parseMoney,
} from '@/lib/money';
import { nowUTC } from '@/lib/date';
import { isPublicSellableProduct } from '@/lib/catalog';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';
import type {
  OrderWithItems,
  OrderStatus,
  PaymentMethod,
  SaleItemInput,
} from '@/domain/types';
import {
  validateCartAvailability,
  updateCashRegisterSummary,
  deductStockForItems,
  reintegrateStockForItems,
} from '@/application/services/saleService';
import {
  findRecipesForProducts,
  groupRecipesByProduct,
  type RecipeWithSupply,
} from '@/application/services/summaryService';

export interface CreateOrderInput {
  branchId: number;
  items: SaleItemInput[];
  customerName: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}

export interface ConvertOrderInput {
  branchId: number;
  orderId: number;
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}

function generateOrderNumber(branchId: number): string {
  return `PED-${branchId}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function generateCancellationToken(): string {
  return randomBytes(32).toString('hex');
}

async function getOrderByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderWithItems | null> {
  const order = (await db.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key),
      isNull(orders.deletedAt)
    ),
    with: {
      items: { with: { product: true } },
    },
  })) as OrderWithItems | undefined;

  return order ?? null;
}

async function buildProductContext(
  branchId: number,
  productIds: number[],
  options?: { includeDeleted?: boolean }
) {
  const productsList = await productRepository.findByIds(
    branchId,
    productIds,
    options?.includeDeleted
  );

  if (productsList.length !== productIds.length) {
    throw new NotFoundError('Producto');
  }

  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  let recipesByProduct = new Map<number, RecipeWithSupply[]>();
  if (compoundProductIds.length > 0) {
    const allRecipes = await findRecipesForProducts(branchId, compoundProductIds);
    recipesByProduct = groupRecipesByProduct(allRecipes);
  }

  return { productById, recipesByProduct, productsList };
}

export async function createOrder(
  input: CreateOrderInput
): Promise<OrderWithItems> {
  const { branchId, items, customerName, deliveryType, address, notes, idempotencyKey } = input;

  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    throw new NotFoundError('Sucursal', branchId);
  }

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  const existing = await getOrderByIdempotencyKey(branchId, branchIdempotencyKey);
  if (existing) {
    return existing;
  }

  const productIds = items.map((item) => item.productId);
  const { productById, recipesByProduct } = await buildProductContext(
    branchId,
    productIds
  );

  for (const item of items) {
    const product = productById.get(item.productId)!;

    if (product.branchId !== branchId) {
      throw new ValidationError(
        `El producto ${product.name} no pertenece a la sucursal.`
      );
    }

    if (!product.isActive) {
      throw new ValidationError(
        `El producto ${product.name} no está activo.`
      );
    }

    if (!isPublicSellableProduct(product)) {
      throw new ValidationError(
        `El producto ${product.name} no está disponible para el pedido.`
      );
    }
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
    let orderTotal = parseMoney(0);
    const orderItemValues: {
      productId: number;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const product = productById.get(item.productId)!;
      const unitPrice = parseMoney(product.price);
      const subtotal = multiplyMoney(unitPrice, item.quantity);
      orderTotal = addMoney(orderTotal, subtotal);

      orderItemValues.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: moneyToNumber(subtotal),
      });
    }

    const orderNumber = generateOrderNumber(branchId);
    const cancellationToken = generateCancellationToken();

    const [order] = await tx
      .insert(orders)
      .values({
        branchId,
        orderNumber,
        total: moneyToNumber(orderTotal),
        status: 'pending',
        customerName: customerName.trim(),
        deliveryType,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        cancellationToken,
        idempotencyKey: branchIdempotencyKey,
        createdAt: nowUTC(),
      })
      .returning();

    await tx.insert(orderItems).values(
      orderItemValues.map((item) => ({
        ...item,
        orderId: order.id,
      }))
    );

    await deductStockForItems(
      tx,
      branchId,
      orderItemValues,
      productById,
      recipesByProduct,
      { orderId: order.id },
      'order'
    );

    const resultItems: OrderWithItems['items'] = orderItemValues.map((item) => ({
      ...item,
      id: 0,
      orderId: order.id,
      product: productById.get(item.productId)!,
    }));

    return { ...order, items: resultItems } as OrderWithItems;
  });
}

export async function cancelOrder(
  branchId: number,
  id: number,
  reason: string,
  token?: string
): Promise<OrderWithItems> {
  const order = (await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.branchId, branchId), isNull(orders.deletedAt)),
    with: { items: true },
  })) as (OrderWithItems & { items: { productId: number; quantity: number }[] }) | undefined;

  if (!order) {
    throw new NotFoundError('Pedido', id);
  }

  if (order.status === 'cancelled') {
    return order as OrderWithItems;
  }

  if (order.status !== 'pending') {
    throw new ValidationError(
      'El pedido no puede cancelarse porque ya fue confirmado.'
    );
  }

  if (token !== undefined && order.cancellationToken !== token) {
    throw new ValidationError('El token de cancelación no es válido.');
  }

  const productIds = order.items.map((item) => item.productId);
  const { productById, recipesByProduct } = await buildProductContext(
    branchId,
    productIds,
    { includeDeleted: true }
  );

  return executeInTransaction(async (tx) => {
    await reintegrateStockForItems(
      tx,
      branchId,
      order.items,
      productById,
      recipesByProduct,
      { orderId: order.id },
      'order_cancellation'
    );

    const [updated] = await tx
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: nowUTC(),
        cancellationReason: reason,
      })
      .where(and(eq(orders.id, id), eq(orders.branchId, branchId)))
      .returning();

    return { ...updated, items: order.items } as OrderWithItems;
  });
}

export async function convertOrderToSale(
  input: ConvertOrderInput
): Promise<typeof sales.$inferSelect> {
  const { branchId, orderId, paymentMethod, idempotencyKey } = input;

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  if (
    await idempotencyService.isIdempotencyKeyUsed(
      'sale',
      branchId,
      branchIdempotencyKey
    )
  ) {
    const existingSale = await db.query.sales.findFirst({
      where: and(
        eq(sales.branchId, branchId),
        eq(sales.idempotencyKey, branchIdempotencyKey)
      ),
    });

    if (!existingSale) {
      throw new ValidationError('La venta ya fue procesada.');
    }

    return existingSale;
  }

  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!cashRegister) {
    throw new ValidationError(
      'No hay una caja abierta. Abrí la caja para confirmar el pedido.'
    );
  }

  const order = (await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.branchId, branchId), isNull(orders.deletedAt)),
    with: { items: true },
  })) as OrderWithItems | undefined;

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  if (order.status !== 'pending') {
    throw new ValidationError('El pedido no está pendiente de confirmación.');
  }

  const productIds = order.items.map((item) => item.productId);
  const { productById, recipesByProduct } = await buildProductContext(
    branchId,
    productIds
  );

  for (const item of order.items) {
    const product = productById.get(item.productId)!;

    if (!product.isActive) {
      throw new ValidationError(
        `El producto ${product.name} no está activo.`
      );
    }

    if (!isPublicSellableProduct(product)) {
      throw new ValidationError(
        `El producto ${product.name} no está disponible para la venta.`
      );
    }
  }

  return executeInTransaction(async (tx) => {
    const saleItemValues = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    const [sale] = await tx
      .insert(sales)
      .values({
        branchId,
        total: order.total,
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
        'La caja fue cerrada mientras se confirmaba el pedido.'
      );
    }

    await updateCashRegisterSummary(
      tx,
      lockedCashRegister,
      saleItemValues,
      productById,
      recipesByProduct,
      paymentMethod,
      order.total,
      'add'
    );

    await tx
      .update(orders)
      .set({
        status: 'converted',
        convertedSaleId: sale.id,
      })
      .where(and(eq(orders.id, orderId), eq(orders.branchId, branchId)));

    return sale;
  });
}

export async function getOrderById(
  branchId: number,
  id: number
): Promise<OrderWithItems | undefined> {
  return (await db.query.orders.findFirst({
    where: and(
      eq(orders.id, id),
      eq(orders.branchId, branchId),
      isNull(orders.deletedAt)
    ),
    with: {
      items: { with: { product: true } },
    },
  })) as OrderWithItems | undefined;
}

export async function getPendingOrders(
  branchId: number
): Promise<OrderWithItems[]> {
  return (await db.query.orders.findMany({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.status, 'pending'),
      isNull(orders.deletedAt)
    ),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    with: { items: { with: { product: true } } },
  })) as OrderWithItems[];
}

export async function getOrders(
  branchId: number,
  options: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: OrderWithItems[]; total: number; page: number; limit: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(orders.branchId, branchId),
    isNull(orders.deletedAt),
  ];

  if (options.status) {
    conditions.push(eq(orders.status, options.status));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(...conditions));

  const items = (await db.query.orders.findMany({
    where: and(...conditions),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    limit,
    offset,
    with: { items: { with: { product: true } } },
  })) as OrderWithItems[];

  return {
    items,
    total: Number(total),
    page,
    limit,
  };
}
