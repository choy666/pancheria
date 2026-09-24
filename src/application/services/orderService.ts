import { db } from '@/db';
import * as orderRepository from '@/repositories/orderRepository';
import type {
  OrderIdempotencyLookup,
  OrderItemRecipeInsert,
} from '@/repositories/orderRepository';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import type { StockMovementInsert } from '@/repositories/stockMovementRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as orderStockReservationRepository from '@/repositories/orderStockReservationRepository';
import type { SaleRow } from '@/repositories/saleRepository';
import { executeInTransaction } from '@/application/transactionService';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as idempotencyService from '@/application/idempotencyService';

import { nowUTC } from '@/lib/date';
import {
  getOrderExpirationMs,
  getExpireOrdersTimeBudgetMs,
} from '@/config/orders';
import { logger } from '@/lib/logger';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';
import { getCurrentOrNextOpening, isBranchOpen } from '@/lib/branch-helpers';
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

type CreateOrderPayload = Omit<CreateOrderInput, 'idempotencyKey'>;

function createOrderRequestHash(input: CreateOrderPayload): string {
  return idempotencyService.createIdempotencyHash('order.create', {
    branchId: input.branchId,
    items: idempotencyService.normalizeIdempotencyItems(input.items),
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.replace(/\s/g, ''),
    deliveryType: input.deliveryType,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  });
}

function createStoredOrderRequestHash(order: OrderWithItems): string | null {
  if (
    order.items.some(
      (item) =>
        !item.product ||
        (item.product.type === 'compound' && !item.recipeSnapshot?.length)
    )
  ) {
    return null;
  }

  return createOrderRequestHash({
    branchId: order.branchId,
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedRecipeItemIds:
        item.recipeSnapshot
          ?.filter((recipe) => recipe.isOptional && recipe.selected)
          .map((recipe) => recipe.supplyId) ?? [],
    })),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryType: order.deliveryType,
    address: order.address,
    notes: order.notes,
  });
}

async function getOrderByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderIdempotencyLookup | null> {
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

  const rows: StockMovementInsert[] = reservations.map((reservation) => ({
    branchId,
    productId: reservation.productId,
    type,
    quantity: type === 'reserve' ? -reservation.quantity : reservation.quantity,
    saleId: null,
    orderId,
    reason,
    createdAt: nowUTC(),
  }));

  await stockMovementRepository.insertMany(tx, rows);
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
): Promise<OrderWithItems & { deduplicated?: boolean }> {
  const { branchId, items, customerName, customerPhone, deliveryType, address, notes, idempotencyKey } = input;
  const requestHash = createOrderRequestHash(input);

  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    throw new NotFoundError('Sucursal', branchId);
  }

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;
  const existing = await getOrderByIdempotencyKey(branchId, branchIdempotencyKey);
  if (existing) {
    idempotencyService.assertIdempotencyHashMatches(
      existing.idempotencyHash ?? createStoredOrderRequestHash(existing.order),
      requestHash
    );
    return { ...existing.order, deduplicated: true };
  }

  // Misma regla que `GET /api/public/sucursal/estado`: con horarios
  // configurados la sucursal solo está abierta dentro de la franja vigente.
  // Sin esto un pedido directo a la API entraba fuera de horario aunque la
  // UI ocultara el formulario y `/estado` reportara la sucursal cerrada.
  const hasOpeningHours = (branch.openingHours ?? []).length > 0;
  if (hasOpeningHours && !isBranchOpen(branch)) {
    const opening = getCurrentOrNextOpening(branch);
    throw new ValidationError(
      `En este momento no podemos recibir pedidos. Horario de atención: ${opening}.`
    );
  }

  const openCashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!openCashRegister) {
    throw new ValidationError('En este momento no podemos recibir pedidos.');
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

    const orderValues = {
      ...buildOrderValues({
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
      }),
      idempotencyHash: requestHash,
    };

    const { order, isNew } = await orderRepository.insertOrderIdempotent(
      tx,
      orderValues
    );

    if (!isNew) {
      const existing = await getOrderByIdempotencyKey(
        branchId,
        branchIdempotencyKey
      );
      if (!existing) {
        throw new NotFoundError('Pedido', order.id);
      }
      idempotencyService.assertIdempotencyHashMatches(
        order.idempotencyHash ??
          existing.idempotencyHash ??
          createStoredOrderRequestHash(existing.order),
        requestHash
      );
      return { ...existing.order, deduplicated: true };
    }

    const orderItemsToInsert = buildOrderItemValues(orderItemValues, order.id);

    const insertedOrderItems = await orderRepository.insertItems(
      tx,
      orderItemsToInsert
    );

    const recipeRows: OrderItemRecipeInsert[] = [];
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

    await orderRepository.insertItemRecipes(tx, recipeRows);

    const recipeMessage = buildRecipeSnapshotMessageContent(orderItemValues);
    if (recipeMessage) {
      await orderMessageRepository.insertMessage(tx, {
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

    const safeOrder = idempotencyService.stripIdempotencyHash(order);
    return { ...safeOrder, branch, items: resultItems } as OrderWithItems;
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

  // Con token (vía pública) solo se cancela `pending`/`in_process`: un pedido
  // `paid` implica anular dinero real y solo puede hacerlo el negocio desde
  // el panel (sin token).
  if (token !== undefined && order.status === 'paid') {
    throw new ValidationError(
      'El pedido ya fue pagado. Para anularlo, comunicate con la sucursal.'
    );
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

    if (token !== undefined && locked.status === 'paid') {
      throw new ValidationError(
        'El pedido ya fue pagado. Para anularlo, comunicate con la sucursal.'
      );
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
): Promise<Omit<SaleRow, 'idempotencyHash'> & { deduplicated?: boolean }> {
  const { branchId, orderId, payments, idempotencyKey } = input;
  const requestHash = idempotencyService.createIdempotencyHash(
    'sale.order-conversion',
    {
      branchId,
      orderId,
      payments: idempotencyService.normalizeIdempotencyPayments(payments),
    }
  );

  const branchIdempotencyKey = `${branchId}:${idempotencyKey}`;
  const preExistingSale = await idempotencyService.findExistingByIdempotencyKey(
    'sale',
    branchId,
    branchIdempotencyKey
  );
  if (preExistingSale) {
    idempotencyService.assertIdempotencyHashMatches(
      preExistingSale.idempotencyHash,
      requestHash
    );
    return {
      ...idempotencyService.stripIdempotencyHash(preExistingSale),
      deduplicated: true,
    };
  }

  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  if (!cashRegister) {
    // La causa es la caja cerrada, no el horario de la sucursal: el mensaje
    // anterior ("Horario de atención") confundía al operador (D10).
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

  const paymentValidation = validatePaymentParts(payments, order.total);
  if (!paymentValidation.valid) {
    throw new ValidationError(paymentValidation.error ?? 'Pago inválido.');
  }

  try {
    return await executeInTransaction(async (tx) => {
      const existingSale = await idempotencyService.findExistingByIdempotencyKey(
        'sale',
        branchId,
        branchIdempotencyKey,
        tx
      );
      if (existingSale) {
        idempotencyService.assertIdempotencyHashMatches(
          existingSale.idempotencyHash,
          requestHash
        );
        return {
          ...idempotencyService.stripIdempotencyHash(existingSale),
          deduplicated: true,
        };
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

      // Misma frontera que `receiveOrder`: un `pending` vencido y aún no
      // barrido no puede convertirse en venta. La detección ocurre bajo el
      // lock; la cancelación efectiva la hace el `catch` externo en una
      // transacción propia (un throw adentro haría rollback de todo).
      if (isExpiredPending(lockedOrder)) {
        throw new ExpiredPendingOrderError(
          'El pedido expiró por inactividad y fue cancelado.'
        );
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
        await productRepository.lockForUpdate(tx, productIdsToLock, branchId);
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
        requestHash,
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
  } catch (error) {
    // El throw dentro de la transacción ya hizo rollback; la cancelación
    // se confirma acá, con su propio lock, antes de propagar el 409.
    if (error instanceof ExpiredPendingOrderError) {
      await cancelExpiredOrder(branchId, orderId, EXPIRED_ORDER_REASON);
      throw new ConflictError(error.message);
    }
    throw error;
  }
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

  try {
    return await executeInTransaction(async (tx) => {
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

      // El barrido de expiración es lazy y el cron puede demorar horas: un
      // `pending` vencido que todavía no fue barrido no debe poder
      // recibirse. La detección ocurre bajo el lock de la fila; la
      // cancelación efectiva la confirma el `catch` externo.
      if (isExpiredPending(locked)) {
        throw new ExpiredPendingOrderError(
          'El pedido expiró por inactividad y fue cancelado.'
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
        await productRepository.lockForUpdate(tx, productIdsToLock);
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
  } catch (error) {
    // El throw dentro de la transacción ya hizo rollback; la cancelación
    // se confirma acá, con su propio lock, antes de propagar el 409.
    if (error instanceof ExpiredPendingOrderError) {
      await cancelExpiredOrder(branchId, orderId, EXPIRED_ORDER_REASON);
      throw new ConflictError(error.message);
    }
    throw error;
  }
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
  let order = await orderRepository.findById(branchId, id);
  if (!order) return undefined;

  // Expiración lazy: si el pedido pending ya venció (el cron puede demorar
  // horas), se cancela en el momento y se relee para devolver el estado real.
  if ((await expireStalePendingOrders([order])).size > 0) {
    order = await orderRepository.findById(branchId, id);
    if (!order) return undefined;
  }

  const unreadCount = await orderMessageRepository.countUnreadByOrderAndSender(
    order.id,
    'client'
  );

  return { ...order, unreadCount };
}

export async function getPendingOrders(
  branchId: number
): Promise<OrderWithItems[]> {
  const orders = await orderRepository.findPending(branchId);
  const expiredIds = await expireStalePendingOrders(orders);
  if (expiredIds.size === 0) return orders;
  return orders.filter((order) => !expiredIds.has(order.id));
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
  const result = await orderRepository.findOrders(branchId, options);
  const expiredIds = await expireStalePendingOrders(result.items);
  if (expiredIds.size === 0) return result;
  return {
    ...result,
    items: result.items.filter((order) => !expiredIds.has(order.id)),
    total: result.total - expiredIds.size,
  };
}

export async function getOrderCountsByStatus(
  branchId: number
): Promise<Record<OrderStatus, number>> {
  return orderRepository.countOrdersByStatus(branchId);
}

export async function expirePendingOrders(
  branchId?: number,
  options: { timeBudgetMs?: number } = {}
): Promise<number> {
  const expirationMs = getOrderExpirationMs();
  const cutoff = new Date(Date.now() - expirationMs);
  const timeBudgetMs = options.timeBudgetMs ?? getExpireOrdersTimeBudgetMs();
  const deadline = Date.now() + timeBudgetMs;

  let expiredCount = 0;
  let budgetExhausted = false;
  // Los pedidos que cambian de estado salen del resultado en la siguiente
  // página; los que fallan quedan registrados para no reintentarlos en esta
  // corrida (la consulta los excluye y este set es la guarda de corte).
  const attemptedOrderIds = new Set<number>();

  for (;;) {
    if (Date.now() >= deadline) {
      budgetExhausted = true;
      break;
    }

    const batch = await orderRepository.findExpiredPendingIds(cutoff, {
      branchId,
      limit: EXPIRED_ORDERS_BATCH_SIZE,
      excludeIds: [...attemptedOrderIds],
    });

    const fresh = batch.filter((order) => !attemptedOrderIds.has(order.id));
    if (fresh.length === 0) break;

    for (const order of fresh) {
      if (Date.now() >= deadline) {
        budgetExhausted = true;
        break;
      }

      attemptedOrderIds.add(order.id);
      try {
        const cancelled = await cancelExpiredOrder(
          order.branchId,
          order.id,
          EXPIRED_ORDER_REASON
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

    if (budgetExhausted) break;
  }

  if (budgetExhausted) {
    // La corrida es reentrante: los pendientes que quedan se procesan en la
    // próxima invocación del cron. Se reporta el trabajo restante para que
    // el operador pueda dimensionar la frecuencia o el presupuesto.
    const remaining = await orderRepository.countExpiredPending(cutoff, {
      branchId,
    });
    logger.info('expirePendingOrders: presupuesto de tiempo agotado', {
      expired: expiredCount,
      remaining,
      timeBudgetMs,
    });
  }

  return expiredCount;
}

const EXPIRED_ORDERS_BATCH_SIZE = 200;

const EXPIRED_ORDER_REASON = 'Expiración automática por inactividad';

/**
 * Expira en lectura los pedidos `pending` que ya superaron
 * `ORDER_EXPIRATION_MS`. Es el respaldo del cron `expire-orders`: la
 * cadencia real de GitHub Actions puede ser de horas y sin esto un pedido
 * vencido seguiría mostrándose como vigente en seguimiento y panel.
 * `cancelExpiredOrder` re-verifica el estado bajo lock, así que es segura
 * ante carreras con confirmaciones/cancelaciones concurrentes.
 * Devuelve los ids efectivamente cancelados.
 */
async function expireStalePendingOrders(
  candidates: {
    id: number;
    branchId: number;
    status: OrderStatus;
    createdAt: Date;
  }[]
): Promise<Set<number>> {
  const cutoffMs = Date.now() - getOrderExpirationMs();
  const expiredIds = new Set<number>();

  for (const order of candidates) {
    if (order.status !== 'pending') continue;
    if (order.createdAt.getTime() >= cutoffMs) continue;
    try {
      if (
        await cancelExpiredOrder(order.branchId, order.id, EXPIRED_ORDER_REASON)
      ) {
        expiredIds.add(order.id);
      }
    } catch (error) {
      // Una lectura no debe fallar porque el pedido cambió de estado entre
      // la consulta y la cancelación; el próximo cron lo barre igual.
      if (error instanceof DomainError) {
        continue;
      }
      throw error;
    }
  }

  return expiredIds;
}

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

/**
 * `true` si el pedido sigue en `pending` pero ya superó la ventana
 * `ORDER_EXPIRATION_MS`. Solo aplica a `pending`: un pedido `in_process`
 * ya fue aceptado por el operador y no vence.
 */
function isExpiredPending(order: { status: OrderStatus; createdAt: Date }): boolean {
  return (
    order.status === 'pending' &&
    order.createdAt.getTime() < Date.now() - getOrderExpirationMs()
  );
}

/**
 * Sentinela interna de `receiveOrder`/`convertOrderToSale`: se lanza
 * dentro de la transacción cuando el lock muestra un `pending` vencido.
 * El throw revierte la transacción completa —por eso la cancelación no
 * puede hacerse adentro— y el `catch` de cada función la confirma con
 * `cancelExpiredOrder` en una transacción propia antes de devolver 409.
 */
class ExpiredPendingOrderError extends ConflictError {}

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
  branchId: number,
  orderNumber: string,
  customerName?: string,
  customerPhone?: string
): Promise<TrackOrderResult | null> {
  if (!customerName?.trim() && !customerPhone?.trim()) {
    return null;
  }

  const order = await orderRepository.findByOrderNumberAndCustomer(
    branchId,
    orderNumber,
    customerName,
    customerPhone
  );

  if (!order) {
    return null;
  }

  // Expiración lazy: si el pending ya venció, se cancela ahora y el cliente
  // ve el estado real en lugar de un pedido "vigente" con `expiresAt` pasado.
  const expiredIds = await expireStalePendingOrders([order]);
  const status: OrderStatus = expiredIds.has(order.id)
    ? 'cancelled'
    : order.status;

  const result: TrackOrderResult = {
    id: order.id,
    orderNumber: order.orderNumber,
    status,
    total: order.total,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    branchId: order.branchId,
    branchName: order.branch?.name ?? null,
  };

  if (status === 'pending') {
    result.cancellationToken = order.cancellationToken;
    result.expiresAt = new Date(
      order.createdAt.getTime() + getOrderExpirationMs()
    ).toISOString();
  }

  return result;
}
