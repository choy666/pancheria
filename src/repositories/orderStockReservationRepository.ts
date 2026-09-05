import { eq, and, inArray, sql } from 'drizzle-orm';
import { orderStockReservations, orders } from '@/db/schema';

export interface ReservationInput {
  branchId: number;
  orderId: number;
  productId: number;
  quantity: number;
}

export async function findByOrderId(
  tx: typeof import('@/db').db,
  orderId: number
): Promise<ReservationInput[]> {
  return tx
    .select({
      branchId: orderStockReservations.branchId,
      orderId: orderStockReservations.orderId,
      productId: orderStockReservations.productId,
      quantity: orderStockReservations.quantity,
    })
    .from(orderStockReservations)
    .where(eq(orderStockReservations.orderId, orderId));
}

export async function findActiveReservationsByProductIds(
  tx: typeof import('@/db').db,
  branchId: number,
  productIds: number[],
  excludeOrderId?: number
): Promise<{ productId: number; quantity: number }[]> {
  if (productIds.length === 0) return [];

  const inProcessOrderIds = tx
    .select({ orderId: orders.id })
    .from(orders)
    .where(
      and(eq(orders.branchId, branchId), eq(orders.status, 'in_process'))
    );

  const conditions = [
    eq(orderStockReservations.branchId, branchId),
    inArray(orderStockReservations.productId, productIds),
    inArray(orderStockReservations.orderId, inProcessOrderIds),
  ];

  if (excludeOrderId !== undefined) {
    conditions.push(sql`${orderStockReservations.orderId} <> ${excludeOrderId}`);
  }

  const rows = await tx
    .select({
      productId: orderStockReservations.productId,
      quantity: orderStockReservations.quantity,
    })
    .from(orderStockReservations)
    .where(and(...conditions));

  const quantityByProduct = new Map<number, number>();
  for (const row of rows) {
    quantityByProduct.set(
      row.productId,
      (quantityByProduct.get(row.productId) ?? 0) + row.quantity
    );
  }

  return Array.from(quantityByProduct.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export async function insertReservations(
  tx: typeof import('@/db').db,
  reservations: ReservationInput[]
): Promise<void> {
  if (reservations.length === 0) return;

  await tx.insert(orderStockReservations).values(reservations);
}

export async function deleteByOrderId(
  tx: typeof import('@/db').db,
  orderId: number
): Promise<void> {
  await tx
    .delete(orderStockReservations)
    .where(eq(orderStockReservations.orderId, orderId));
}
