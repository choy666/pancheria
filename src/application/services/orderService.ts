import { sales } from '@/db/schema';
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';

import { nowUTC } from '@/lib/date';
import { getOrderExpirationMs } from '@/config/orders';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type {
  OrderWithItems,
  OrderWithUnreadCount,
  OrderStatus,
  PaymentMethod,
  SaleItemInput,
} from '@/domain/types';
import {
  buildProductContext,
  validateProductsForOperation,
  validateCartAvailability,
  assertNoStockShortage,
} from '@/lib/product-helpers';
import { buildSaleItemValues } from '@/lib/sale-helpers';
import {
  generateOrderNumber,
  generateCancellationToken,
  buildOrderValues,
  buildOrderItemValues,
} from '@/lib/order-helpers';
import { insertSaleAndUpdateCashRegister } from '@/application/services/saleService';

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

async function getOrderByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderWithItems | null> {
  return orderRepository.findByIdempotencyKey(branchId, key);
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

  return executeInTransaction(async (tx) => {
    const productIds = items.map((item) => item.productId);
    const { productById } = await buildProductContext(branchId, productIds, {
      dbOrTx: tx,
    });

    validateProductsForOperation(items, productById, branchId, 'pedido');

    const { shortageByProduct } = await validateCartAvailability(
      branchId,
      items,
      undefined,
      tx
    );

    assertNoStockShortage(shortageByProduct, productById);

    const { saleItemValues: orderItemValues, total: orderTotal } =
      buildSaleItemValues(productById, items);

    const orderNumber = generateOrderNumber(branchId);
    const cancellationToken = generateCancellationToken();

    const orderValues = buildOrderValues({
      branchId,
      orderNumber,
      total: orderTotal,
      customerName,
      deliveryType,
      address,
      notes,
      cancellationToken,
      idempotencyKey: branchIdempotencyKey,
    });

    const order = await orderRepository.insertOrder(tx, orderValues);

    const orderItemsToInsert = buildOrderItemValues(orderItemValues, order.id);

    await orderRepository.insertOrderItems(tx, orderItemsToInsert);

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
  const order = await orderRepository.findById(branchId, id);

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
    const locked = await orderRepository.findByIdForUpdate(tx, branchId, id);

    if (!locked) {
      throw new NotFoundError('Pedido', id);
    }

    if (locked.status === 'cancelled') {
      return order as OrderWithItems;
    }

    if (locked.status !== 'pending') {
      throw new ValidationError(
        'El pedido no puede cancelarse porque ya fue confirmado.'
      );
    }

    if (token !== undefined && locked.cancellationToken !== token) {
      throw new ValidationError('El token de cancelación no es válido.');
    }

    const updated = await orderRepository.cancel(tx, branchId, id, {
      status: 'cancelled',
      cancelledAt: nowUTC(),
      cancellationReason: reason,
    });

    return { ...updated, branch: order.branch, items: order.items } as OrderWithItems;
  });
}

export async function convertOrderToSale(
  input: ConvertOrderInput
): Promise<typeof sales.$inferSelect> {
  const { branchId, orderId, paymentMethod, idempotencyKey } = input;

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!cashRegister) {
    throw new ValidationError(
      'No hay una caja abierta. Abrí la caja para confirmar el pedido.'
    );
  }

  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  if (order.status !== 'pending') {
    throw new ValidationError('El pedido no está pendiente de confirmación.');
  }

  return executeInTransaction(async (tx) => {
    const existingSale = await idempotencyService.findExistingByIdempotencyKey(
      'sale',
      branchId,
      branchIdempotencyKey,
      tx
    );
    if (existingSale) {
      return existingSale;
    }

    const lockedOrder = await orderRepository.findByIdForUpdate(
      tx,
      branchId,
      orderId
    );

    if (!lockedOrder) {
      throw new NotFoundError('Pedido', orderId);
    }

    if (lockedOrder.status !== 'pending') {
      throw new ValidationError('El pedido no está pendiente de confirmación.');
    }

    const productIds = order.items.map((item) => item.productId);
    const { productById, recipesByProduct } = await buildProductContext(
      branchId,
      productIds,
      { dbOrTx: tx }
    );

    validateProductsForOperation(order.items, productById, branchId, 'venta');

    const { shortageByProduct } = await validateCartAvailability(
      branchId,
      order.items,
      undefined,
      tx
    );

    assertNoStockShortage(shortageByProduct, productById);

    const { saleItemValues, total: saleTotal } = buildSaleItemValues(
      productById,
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }))
    );

    const sale = await insertSaleAndUpdateCashRegister(
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

    await orderRepository.updateStatus(tx, branchId, orderId, {
      status: 'converted',
      convertedSaleId: sale.id,
    });

    return sale;
  });
}

export async function getOrderById(
  branchId: number,
  id: number
): Promise<OrderWithUnreadCount | undefined> {
  const order = await orderRepository.findById(branchId, id);
  if (!order) return undefined;

  const unreadCount = await orderMessageRepository.countUnreadByOrderAndSender(
    order.id,
    'client'
  );

  return { ...order, unreadCount };
}

export async function getPendingOrders(
  branchId: number
): Promise<OrderWithItems[]> {
  return orderRepository.findPending(branchId);
}

export async function getOrders(
  branchId: number,
  options: {
    status?: OrderStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: OrderWithUnreadCount[]; total: number; page: number; limit: number }> {
  return orderRepository.findOrders(branchId, options);
}

export async function expirePendingOrders(
  branchId?: number
): Promise<number> {
  const expirationMs = getOrderExpirationMs();
  const cutoff = new Date(Date.now() - expirationMs);

  const expiredOrders =
    branchId === undefined
      ? await orderRepository.findExpiredPendingAll(cutoff)
      : await orderRepository.findExpiredPending(branchId, cutoff);

  let expiredCount = 0;

  for (const order of expiredOrders) {
    try {
      await cancelOrder(
        order.branchId,
        order.id,
        'Expiración automática por inactividad'
      );
      expiredCount += 1;
    } catch (error) {
      // Si el pedido fue confirmado o cancelado entre la búsqueda y la
      // cancelación, no interrumpimos la limpieza del resto.
      if (
        error instanceof ValidationError &&
        error.message.includes('confirmado')
      ) {
        continue;
      }
      throw error;
    }
  }

  return expiredCount;
}

export interface TrackOrderResult {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  customerName: string;
  branchId: number;
  branchName: string | null;
  cancellationToken?: string;
  expiresAt?: string;
}

export async function trackOrder(
  orderNumber: string,
  customerName: string
): Promise<TrackOrderResult | null> {
  const order =
    await orderRepository.findByOrderNumberAndCustomerName(
      orderNumber,
      customerName
    );

  if (!order) {
    return null;
  }

  const result: TrackOrderResult = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    customerName: order.customerName,
    branchId: order.branchId,
    branchName: order.branch?.name ?? null,
  };

  if (order.status === 'pending') {
    result.cancellationToken = order.cancellationToken;
    result.expiresAt = new Date(
      order.createdAt.getTime() + getOrderExpirationMs()
    ).toISOString();
  }

  return result;
}
