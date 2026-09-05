import { inArray, eq, and, asc } from 'drizzle-orm';
import { db } from '@/db';
import { sales, products, stockMovements, orderItems, orderItemRecipes, orderMessages } from '@/db/schema';
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as orderStockReservationRepository from '@/repositories/orderStockReservationRepository';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';

import { nowUTC } from '@/lib/date';
import { getOrderExpirationMs } from '@/config/orders';
import { DomainError, NotFoundError, ValidationError } from '@/domain/errors';
import { getCurrentOrNextOpening } from '@/lib/branch-helpers';
import type {
  OrderWithItems,
  OrderWithUnreadCount,
  OrderStatus,
  PaymentPart,
  SaleItemInput,
  ProductRow,
  RecipeItemConfig,
  OrderItem,
} from '@/domain/types';
import type { RecipeWithSupply } from '@/lib/recipe-helpers';
import {
  buildProductContext,
  validateProductsForOperation,
  validateCartAvailability,
  assertNoStockShortage,
  buildRecipeSnapshot,
} from '@/lib/product-helpers';
import { prepareCart } from '@/lib/cart-pipeline';
import {
  generateOrderNumber,
  generateCancellationToken,
  buildOrderValues,
  buildOrderItemValues,
  buildRecipeSnapshotMessageContent,
} from '@/lib/order-helpers';
import {
  collectStockProductIdsToLock,
  iterRecipeConsumptions,
  buildStockMovementReason,
} from '@/lib/stock-helpers';
import { validatePaymentParts } from '@/lib/payment-helpers';
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
  payments: PaymentPart[];
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

function ensureOrderRecipeSnapshots(
  items: OrderItem[],
  recipesByProduct: Map<number, RecipeWithSupply[]>
): OrderItem[] {
  return items.map((item) => {
    const recipeList = recipesByProduct.get(item.productId) ?? [];
    if (recipeList.length === 0) return item;
    if (item.recipeSnapshot && item.recipeSnapshot.length > 0) return item;

    const selectedIds =
      item.recipeSnapshot?.filter((s) => s.selected).map((s) => s.supplyId) ?? [];
    const newSnapshot = buildRecipeSnapshot(recipeList, selectedIds);

    return { ...item, recipeSnapshot: newSnapshot };
  });
}

function toSaleItemInputWithSelection(
  items: OrderItem[]
): SaleItemInput[] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    selectedRecipeItemIds:
      item.recipeSnapshot?.filter((s) => s.selected).map((s) => s.supplyId) ?? [],
    recipeSnapshot: item.recipeSnapshot,
  }));
}

async function getOrderByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderWithItems | null> {
  return orderRepository.findByIdempotencyKey(branchId, key);
}

async function insertStockReserveMovements(
  tx: typeof db,
  branchId: number,
  orderId: number,
  reservations: ReservationInput[],
  type: 'reserve' | 'reserve_release'
) {
  if (reservations.length === 0) return;

  const reason = buildStockMovementReason(type, undefined, orderId);

  await tx.insert(stockMovements).values(
    reservations.map((reservation) => ({
      branchId,
      productId: reservation.productId,
      type,
      quantity: type === 'reserve' ? -reservation.quantity : reservation.quantity,
      saleId: null as number | null,
      orderId,
      reason,
      createdAt: nowUTC(),
    }))
  );
}

function buildReservationsForItems(
  branchId: number,
  orderId: number,
  items: { productId: number; quantity: number; recipeSnapshot?: RecipeItemConfig[] }[],
  productById: Map<number, ProductRow>,
  recipesByProduct: Map<number, RecipeWithSupply[]>
): ReservationInput[] {
  const quantityByProduct = new Map<number, number>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    if (product.type === 'compound') {
      const recipeSnapshot = item.recipeSnapshot;
      for (const { supplyId, consumed } of iterRecipeConsumptions(
        product,
        item.quantity,
        recipesByProduct,
        recipeSnapshot
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
      `En este momento no podemos recibir pedidos. Horario de atención: ${opening}.`
    );
  }

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  const existing = await getOrderByIdempotencyKey(branchId, branchIdempotencyKey);
  if (existing) {
    return existing;
  }

  return executeInTransaction(async (tx) => {
    const {
      productById,
      saleItemValues: orderItemValues,
      total: orderTotal,
    } = await prepareCart({
      branchId,
      items,
      operation: 'pedido',
      dbOrTx: tx,
    });

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

    const { order, isNew } = await orderRepository.insertOrderIdempotent(
      tx,
      orderValues
    );

    if (!isNew) {
      const existing = await orderRepository.findById(branchId, order.id);
      if (!existing) {
        throw new NotFoundError('Pedido', order.id);
      }
      return existing;
    }

    const orderItemsToInsert = buildOrderItemValues(orderItemValues, order.id);

    const insertedOrderItems = await tx
      .insert(orderItems)
      .values(orderItemsToInsert)
      .returning();

    const recipeRows: (typeof orderItemRecipes.$inferInsert)[] = [];
    for (let i = 0; i < insertedOrderItems.length; i++) {
      const orderItem = insertedOrderItems[i];
      const snapshot = orderItemValues[i].recipeSnapshot ?? [];
      for (const config of snapshot) {
        recipeRows.push({
          orderItemId: orderItem.id,
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
      await tx.insert(orderItemRecipes).values(recipeRows);
    }

    const recipeMessage = buildRecipeSnapshotMessageContent(orderItemValues);
    if (recipeMessage) {
      await tx.insert(orderMessages).values({
        orderId: order.id,
        senderType: 'operator',
        senderName: 'Sistema',
        content: recipeMessage,
      });
    }

    const resultItems: OrderWithItems['items'] = orderItemValues.map(
      (item, index) => ({
        ...item,
        id: insertedOrderItems[index]?.id ?? 0,
        orderId: order.id,
        product: productById.get(item.productId)!,
      })
    );

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
      const reservationsToRelease =
        await orderStockReservationRepository.findByOrderId(tx, id);
      await orderStockReservationRepository.deleteByOrderId(tx, id);
      await insertStockReserveMovements(
        tx,
        branchId,
        id,
        reservationsToRelease,
        'reserve_release'
      );
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
  const { branchId, orderId, payments, idempotencyKey } = input;

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;

  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!cashRegister) {
    const branch =
      (await branchService.getBranchById(branchId)) ??
      (await orderRepository.findById(branchId, orderId))?.branch;
    const opening = branch
      ? getCurrentOrNextOpening(branch)
      : 'consultá con la sucursal';
    throw new ValidationError(
      `En este momento no podemos confirmar el pedido. Horario de atención: ${opening}.`
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

  const paymentValidation = validatePaymentParts(payments, order.total);
  if (!paymentValidation.valid) {
    throw new ValidationError(paymentValidation.error ?? 'Pago inválido.');
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

    if (lockedOrder.status === 'in_process') {
      const reservationsToRelease =
        await orderStockReservationRepository.findByOrderId(tx, orderId);
      await orderStockReservationRepository.deleteByOrderId(tx, orderId);
      await insertStockReserveMovements(
        tx,
        branchId,
        orderId,
        reservationsToRelease,
        'reserve_release'
      );
    }

    const productIdsToLock = collectStockProductIdsToLock(
      order.items,
      productById,
      recipesByProduct
    );

    if (productIdsToLock.length > 0) {
      await tx
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

    const itemsForValidation = toSaleItemInputWithSelection(order.items);
    const buildItems = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      recipeSnapshot: item.recipeSnapshot,
    }));

    const {
      productById: saleProductById,
      recipesByProduct: saleRecipesByProduct,
      saleItemValues,
      total: saleTotal,
    } = await prepareCart({
      branchId,
      items: itemsForValidation,
      operation: 'venta',
      dbOrTx: tx,
      options: { shouldLock: false, buildItems, excludeOrderId: orderId },
    });

    const paymentTotalValidation = validatePaymentParts(payments, saleTotal);
    if (!paymentTotalValidation.valid) {
      throw new ValidationError(
        paymentTotalValidation.error ?? 'Pago inválido.'
      );
    }

    const sale = await insertSaleAndUpdateCashRegister(
      tx,
      branchId,
      cashRegister,
      branchIdempotencyKey,
      payments,
      saleItemValues,
      saleProductById,
      saleRecipesByProduct
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

    const orderItemsWithSnapshot = ensureOrderRecipeSnapshots(
      order.items,
      recipesByProduct
    );

    const productIdsToLock = collectStockProductIdsToLock(
      orderItemsWithSnapshot,
      productById,
      recipesByProduct
    );

    if (productIdsToLock.length > 0) {
      await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIdsToLock))
        .orderBy(asc(products.id))
        .for('update');
    }

    const itemsForValidation = toSaleItemInputWithSelection(
      orderItemsWithSnapshot
    );

    const { shortageByProduct } = await validateCartAvailability(
      branchId,
      itemsForValidation,
      undefined,
      tx,
      orderId
    );

    assertNoStockShortage(shortageByProduct, productById);

    const existingReservations =
      await orderStockReservationRepository.findByOrderId(tx, orderId);

    if (existingReservations.length === 0) {
      const reservations = buildReservationsForItems(
        branchId,
        orderId,
        orderItemsWithSnapshot,
        productById,
        recipesByProduct
      );
      await orderStockReservationRepository.insertReservations(tx, reservations);
      await insertStockReserveMovements(
        tx,
        branchId,
        orderId,
        reservations,
        'reserve'
      );
    }

    const updated = await orderRepository.updateStatus(tx, branchId, orderId, {
      status: 'in_process',
    });

    return { ...updated, branch: order.branch, items: orderItemsWithSnapshot } as OrderWithItems;
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

export async function getOrderCountsByStatus(
  branchId: number
): Promise<Record<OrderStatus, number>> {
  return orderRepository.countOrdersByStatus(branchId);
}

export async function expirePendingOrders(
  branchId?: number
): Promise<number> {
  const expirationMs = getOrderExpirationMs();
  const cutoff = new Date(Date.now() - expirationMs);

  let expiredCount = 0;
  // Los pedidos que cambian de estado salen del resultado en la siguiente
  // página; los que fallan quedan registrados para no reintentarlos en esta
  // corrida (la consulta los excluye y este set es la guarda de corte).
  const attemptedOrderIds = new Set<number>();

  for (;;) {
    const batch = await orderRepository.findExpiredPendingIds(cutoff, {
      branchId,
      limit: EXPIRED_ORDERS_BATCH_SIZE,
      excludeIds: [...attemptedOrderIds],
    });

    const fresh = batch.filter((order) => !attemptedOrderIds.has(order.id));
    if (fresh.length === 0) break;

    for (const order of fresh) {
      attemptedOrderIds.add(order.id);
      try {
        const cancelled = await cancelExpiredOrder(
          order.branchId,
          order.id,
          'Expiración automática por inactividad'
        );
        if (cancelled) {
          expiredCount += 1;
        }
      } catch (error) {
        // Si el pedido fue modificado o eliminado entre la búsqueda y la
        // cancelación, no interrumpimos la limpieza del resto.
        if (error instanceof DomainError) {
          continue;
        }
        throw error;
      }
    }
  }

  return expiredCount;
}

const EXPIRED_ORDERS_BATCH_SIZE = 200;

/**
 * Cancela un pedido expirado solo si sigue en estado `pending`.
 * Bloquea la fila para evitar carreras con confirmaciones, recepciones o
 * cancelaciones concurrentes. Devuelve `true` si el pedido se canceló.
 */
async function cancelExpiredOrder(
  branchId: number,
  orderId: number,
  reason: string
): Promise<boolean> {
  return executeInTransaction(async (tx) => {
    const locked = await orderRepository.findByIdForUpdate(tx, branchId, orderId);

    if (!locked || locked.status !== 'pending') {
      return false;
    }

    // Un pedido pending no reserva stock; se libera por si quedaron
    // reservas legadas en la base de datos.
    const reservationsToRelease =
      await orderStockReservationRepository.findByOrderId(tx, orderId);
    if (reservationsToRelease.length > 0) {
      await orderStockReservationRepository.deleteByOrderId(tx, orderId);
      await insertStockReserveMovements(
        tx,
        branchId,
        orderId,
        reservationsToRelease,
        'reserve_release'
      );
    }

    await orderRepository.cancel(tx, branchId, orderId, {
      status: 'cancelled',
      cancelledAt: nowUTC(),
      cancellationReason: reason,
    });

    return true;
  });
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
  if (!customerName?.trim() && !customerPhone?.trim()) {
    return null;
  }

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
