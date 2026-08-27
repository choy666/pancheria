import { sales } from '@/db/schema';
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as orderStockReservationRepository from '@/repositories/orderStockReservationRepository';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';

import { nowUTC } from '@/lib/date';
import { getOrderExpirationMs } from '@/config/orders';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { getCurrentOrNextOpening } from '@/lib/branch-helpers';
import type {
  OrderWithItems,
  OrderWithUnreadCount,
  OrderStatus,
  PaymentMethod,
  SaleItemInput,
  ProductRow,
} from '@/domain/types';
import type { RecipeWithSupply } from '@/application/services/summaryService';
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
import { iterRecipeConsumptions } from '@/lib/stock-helpers';
import {
  insertSaleAndUpdateCashRegister,
  cancelSale,
} from '@/application/services/saleService';

export interface CreateOrderInput {
  branchId: number;
  items: SaleItemInput[];
  customerName: string;
  customerPhone: string;
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

export interface ReceiveOrderInput {
  branchId: number;
  orderId: number;
}

export interface FinishOrderInput {
  branchId: number;
  orderId: number;
}

interface ReservationInput {
  branchId: number;
  orderId: number;
  productId: number;
  quantity: number;
}

async function getOrderByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderWithItems | null> {
  return orderRepository.findByIdempotencyKey(branchId, key);
}

function buildReservationsForItems(
  branchId: number,
  orderId: number,
  items: { productId: number; quantity: number }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>
): ReservationInput[] {
  const quantityByProduct = new Map<number, number>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      for (const { supplyId, consumed } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct
      )) {
        quantityByProduct.set(
          supplyId,
          (quantityByProduct.get(supplyId) ?? 0) + consumed
        );
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      quantityByProduct.set(
        product.id,
        (quantityByProduct.get(product.id) ?? 0) + item.quantity
      );
    }
  }

  return Array.from(quantityByProduct.entries()).map(
    ([productId, quantity]) => ({
      branchId,
      orderId,
      productId,
      quantity,
    })
  );
}

export async function createOrder(
  input: CreateOrderInput
): Promise<OrderWithItems> {
  const { branchId, items, customerName, customerPhone, deliveryType, address, notes, idempotencyKey } = input;

  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    throw new NotFoundError('Sucursal', branchId);
  }

  const openCashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!openCashRegister) {
    const opening = getCurrentOrNextOpening(branch);
    throw new ValidationError(
      `La caja de la sucursal está cerrada. Horario de apertura: ${opening}.`
    );
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
      customerPhone,
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

  if (order.status === 'finished') {
    throw new ValidationError(
      'El pedido ya fue finalizado y no puede cancelarse.'
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

    if (locked.status === 'finished') {
      throw new ValidationError(
        'El pedido ya fue finalizado y no puede cancelarse.'
      );
    }

    if (token !== undefined && locked.cancellationToken !== token) {
      throw new ValidationError('El token de cancelación no es válido.');
    }

    if (locked.status === 'in_process') {
      await orderStockReservationRepository.deleteByOrderId(tx, id);
    } else if (locked.status === 'paid' && locked.convertedSaleId) {
      await cancelSale(branchId, locked.convertedSaleId, reason);
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

  if (order.status === 'paid' || order.status === 'finished') {
    throw new ValidationError('El pedido ya fue pagado o finalizado.');
  }

  if (order.status === 'cancelled') {
    throw new ValidationError('El pedido fue cancelado.');
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

    if (
      lockedOrder.status === 'paid' ||
      lockedOrder.status === 'finished' ||
      lockedOrder.status === 'cancelled'
    ) {
      throw new ValidationError('El pedido ya no puede confirmarse como venta.');
    }

    const productIds = order.items.map((item) => item.productId);
    const { productById, recipesByProduct } = await buildProductContext(
      branchId,
      productIds,
      { dbOrTx: tx }
    );

    validateProductsForOperation(order.items, productById, branchId, 'venta');

    if (lockedOrder.status === 'in_process') {
      await orderStockReservationRepository.deleteByOrderId(tx, orderId);
    }

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
      status: 'paid',
      convertedSaleId: sale.id,
    });

    return sale;
  });
}

export async function receiveOrder(
  input: ReceiveOrderInput
): Promise<OrderWithItems> {
  const { branchId, orderId } = input;

  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  if (order.status === 'in_process') {
    return order as OrderWithItems;
  }

  if (order.status !== 'pending') {
    throw new ValidationError(
      'El pedido no puede recibirse porque ya fue pagado, finalizado o cancelado.'
    );
  }

  return executeInTransaction(async (tx) => {
    const locked = await orderRepository.findByIdForUpdate(tx, branchId, orderId);

    if (!locked) {
      throw new NotFoundError('Pedido', orderId);
    }

    if (locked.status === 'in_process') {
      return { ...locked, branch: order.branch, items: order.items } as OrderWithItems;
    }

    if (locked.status !== 'pending') {
      throw new ValidationError(
        'El pedido no puede recibirse porque ya fue pagado, finalizado o cancelado.'
      );
    }

    const productIds = order.items.map((item) => item.productId);
    const { productById, recipesByProduct } = await buildProductContext(
      branchId,
      productIds,
      { dbOrTx: tx }
    );

    validateProductsForOperation(order.items, productById, branchId, 'pedido');

    const { shortageByProduct } = await validateCartAvailability(
      branchId,
      order.items,
      undefined,
      tx
    );

    assertNoStockShortage(shortageByProduct, productById);

    const existingReservations =
      await orderStockReservationRepository.findByOrderId(tx, orderId);

    if (existingReservations.length === 0) {
      const reservations = buildReservationsForItems(
        branchId,
        orderId,
        order.items,
        productById,
        recipesByProduct
      );
      await orderStockReservationRepository.insertReservations(tx, reservations);
    }

    const updated = await orderRepository.updateStatus(tx, branchId, orderId, {
      status: 'in_process',
    });

    return { ...updated, branch: order.branch, items: order.items } as OrderWithItems;
  });
}

export async function finishOrder(
  input: FinishOrderInput
): Promise<OrderWithItems> {
  const { branchId, orderId } = input;

  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  if (order.status === 'finished') {
    return order as OrderWithItems;
  }

  if (order.status !== 'paid') {
    throw new ValidationError(
      'Solo se puede finalizar un pedido que ya fue pagado.'
    );
  }

  return executeInTransaction(async (tx) => {
    const locked = await orderRepository.findByIdForUpdate(tx, branchId, orderId);

    if (!locked) {
      throw new NotFoundError('Pedido', orderId);
    }

    if (locked.status === 'finished') {
      return { ...locked, branch: order.branch, items: order.items } as OrderWithItems;
    }

    if (locked.status !== 'paid') {
      throw new ValidationError(
        'Solo se puede finalizar un pedido que ya fue pagado.'
      );
    }

    const updated = await orderRepository.updateStatus(tx, branchId, orderId, {
      status: 'finished',
    });

    return { ...updated, branch: order.branch, items: order.items } as OrderWithItems;
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
  customerPhone: string;
  branchId: number;
  branchName: string | null;
  cancellationToken?: string;
  expiresAt?: string;
}

export async function trackOrder(
  orderNumber: string,
  customerName?: string,
  customerPhone?: string
): Promise<TrackOrderResult | null> {
  const order = await orderRepository.findByOrderNumberAndCustomer(
    orderNumber,
    customerName,
    customerPhone
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
    customerPhone: order.customerPhone,
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
