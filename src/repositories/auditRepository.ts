import {
  and,
  count,
  eq,
  gt,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  sql,
} from 'drizzle-orm';
import { db } from '@/db';
import {
  branches,
  cashRegisters,
  loginAttempts,
  orderItemRecipes,
  orderItems,
  orderStockReservations,
  orders,
  products,
  publicOrderRateLimits,
  saleItemRecipes,
  saleItems,
  sales,
  stockMovements,
} from '@/db/schema';

/**
 * Consultas de solo lectura para la auditoría de cordura
 * (`GET /api/cron/sanity-audit`). Ninguna función escribe en la base.
 */

export async function getExpiredPendingStats(
  expiredCutoff: Date,
  staleCutoff: Date
): Promise<{ count: number; staleCount: number; oldestCreatedAt: Date | null }> {
  const [row] = await db
    .select({
      count: count(),
      staleCount: sql<number>`count(*) filter (where ${orders.createdAt} < ${staleCutoff})`,
      oldestCreatedAt: sql<Date | null>`min(${orders.createdAt})`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'pending'),
        lt(orders.createdAt, expiredCutoff),
        isNull(orders.deletedAt)
      )
    );

  return {
    count: Number(row?.count ?? 0),
    staleCount: Number(row?.staleCount ?? 0),
    oldestCreatedAt: row?.oldestCreatedAt ?? null,
  };
}

export async function listOpenCashRegisters(): Promise<
  { id: number; branchId: number; openedAt: Date; openedBy: string }[]
> {
  return db
    .select({
      id: cashRegisters.id,
      branchId: cashRegisters.branchId,
      openedAt: cashRegisters.openedAt,
      openedBy: cashRegisters.openedBy,
    })
    .from(cashRegisters)
    .where(
      and(eq(cashRegisters.status, 'open'), isNull(cashRegisters.deletedAt))
    );
}

export async function findNegativeStockProducts(limit: number) {
  return db
    .select({
      id: products.id,
      branchId: products.branchId,
      name: products.name,
      stock: products.stock,
    })
    .from(products)
    .where(lt(products.stock, 0))
    .limit(limit);
}

export async function findLowStockProducts(limit: number) {
  return db
    .select({
      id: products.id,
      branchId: products.branchId,
      name: products.name,
      stock: products.stock,
      minStock: products.minStock,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        isNull(products.deletedAt),
        gt(products.minStock, 0),
        lte(products.stock, products.minStock)
      )
    )
    .orderBy(products.branchId, products.id)
    .limit(limit);
}

export async function findOrphanReservations(limit: number) {
  return db
    .select({
      id: orderStockReservations.id,
      orderId: orderStockReservations.orderId,
      productId: orderStockReservations.productId,
      orderStatus: orders.status,
    })
    .from(orderStockReservations)
    .innerJoin(orders, eq(orderStockReservations.orderId, orders.id))
    .where(ne(orders.status, 'in_process'))
    .limit(limit);
}

export async function findPaidOrdersWithoutSale(limit: number) {
  return db
    .select({
      id: orders.id,
      branchId: orders.branchId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        isNull(orders.convertedSaleId),
        isNull(orders.deletedAt)
      )
    )
    .limit(limit);
}

/**
 * Ítems de venta de productos `compound` sin ninguna fila en
 * `sale_item_recipes`. Sin snapshot, una anulación reintegra contra la
 * receta vigente (`iterRecipeConsumptions` cae a `recipesByProduct`), que
 * pudo haber cambiado desde la venta — típico de ventas previas a la
 * migración que introdujo los snapshots.
 */
export async function countCompoundSaleItemsMissingSnapshot(): Promise<number> {
  const itemsWithSnapshot = db
    .select({ saleItemId: saleItemRecipes.saleItemId })
    .from(saleItemRecipes);

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        eq(products.type, 'compound'),
        notInArray(saleItems.id, itemsWithSnapshot)
      )
    );

  return Number(total);
}

/**
 * Ítems de pedido de productos `compound` sin filas en
 * `order_item_recipes`. `receiveOrder` reconstruye el snapshot de forma
 * defensiva, así que es severidad menor que el equivalente en ventas.
 */
export async function countCompoundOrderItemsMissingSnapshot(): Promise<number> {
  const itemsWithSnapshot = db
    .select({ orderItemId: orderItemRecipes.orderItemId })
    .from(orderItemRecipes);

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(products.type, 'compound'),
        notInArray(orderItems.id, itemsWithSnapshot)
      )
    );

  return Number(total);
}

export async function countOrdersByStatusSince(
  since: Date
): Promise<{ status: string; count: number }[]> {
  const rows = await db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(and(gt(orders.createdAt, since), isNull(orders.deletedAt)))
    .groupBy(orders.status);

  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

export async function sumSalesByStatusSince(
  since: Date
): Promise<{ status: string; count: number; total: number }[]> {
  const rows = await db
    .select({
      status: sales.status,
      count: count(),
      total: sql<string>`coalesce(sum(${sales.total}), 0)`,
    })
    .from(sales)
    .where(gt(sales.createdAt, since))
    .groupBy(sales.status);

  return rows.map((row) => ({
    status: row.status,
    count: Number(row.count),
    total: Number(row.total),
  }));
}

export async function countStockMovementsByTypeSince(
  since: Date
): Promise<{ type: string; count: number }[]> {
  const rows = await db
    .select({ type: stockMovements.type, count: count() })
    .from(stockMovements)
    .where(gt(stockMovements.createdAt, since))
    .groupBy(stockMovements.type);

  return rows.map((row) => ({ type: row.type, count: Number(row.count) }));
}

export async function countRateLimitRows(): Promise<number> {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(publicOrderRateLimits);
  return Number(total);
}

export async function countLoginAttemptRows(): Promise<number> {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(loginAttempts);
  return Number(total);
}

export async function countBranchesByActive(): Promise<
  { isActive: boolean; count: number }[]
> {
  const rows = await db
    .select({ isActive: branches.isActive, count: count() })
    .from(branches)
    .groupBy(branches.isActive);

  return rows.map((row) => ({ isActive: row.isActive, count: Number(row.count) }));
}
