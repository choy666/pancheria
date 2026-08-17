import { eq, and, isNull, count } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'crypto';
import { db } from '@/db';
import { orders, orderItems, sales } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';

import { nowUTC } from '@/lib/date';
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
  validateProductsForOperation,
  buildSaleItemValues,
  insertSaleAndUpdateCashRegister,
  deductStockForItems,
  buildReintegrationContext,
  reintegrateStockAndUpdateCashRegister,
  buildProductContext,
} from '@/application/services/saleService';

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
      branch: true,
      items: { with: { product: true } },
    },
  })) as OrderWithItems | undefined;

  return order ?? null;
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

  validateProductsForOperation(items, productById, branchId, 'pedido');

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

  const { saleItemValues: orderItemValues, total: orderTotal } =
    buildSaleItemValues(productById, items);

  return executeInTransaction(async (tx) => {
    const orderNumber = generateOrderNumber(branchId);
    const cancellationToken = generateCancellationToken();

    const [order] = await tx
      .insert(orders)
      .values({
        branchId,
        orderNumber,
        total: orderTotal,
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

    return { ...order, branch, items: resultItems } as OrderWithItems;
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
    with: { branch: true, items: true },
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

  return executeInTransaction(async (tx) => {
    const { productById, recipesByProduct } = await buildReintegrationContext(
      tx,
      branchId,
      order.items,
      true
    );

    await reintegrateStockAndUpdateCashRegister(
      tx,
      branchId,
      null,
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

    return { ...updated, branch: order.branch, items: order.items } as OrderWithItems;
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

  validateProductsForOperation(order.items, productById, branchId, 'venta');

  const { saleItemValues, total: saleTotal } = buildSaleItemValues(
    productById,
    order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }))
  );

  return executeInTransaction(async (tx) => {
    const sale = await insertSaleAndUpdateCashRegister(
      tx,
      branchId,
      cashRegister,
      branchIdempotencyKey,
      paymentMethod,
      saleTotal,
      saleItemValues,
      productById,
      recipesByProduct,
      { skipStockDeduct: true }
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
      branch: true,
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
    with: { branch: true, items: { with: { product: true } } },
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
    with: { branch: true, items: { with: { product: true } } },
  })) as OrderWithItems[];

  return {
    items,
    total: Number(total),
    page,
    limit,
  };
}
