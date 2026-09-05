import {
  eq,
  inArray,
  isNull,
  isNotNull,
  and,
  gte,
  lte,
  count,
  asc,
  sql,
} from 'drizzle-orm';
import { db } from '@/db';
import {
  products,
  saleItems,
  orderItems,
  saleItemRecipes,
  orderItemRecipes,
  orderStockReservations,
  stockMovements,
  recipes,
} from '@/db/schema';
import { getCurrentTransaction } from '@/application/transactionService';
import { nowUTC } from '@/lib/date';
import type { PaginationParams, PaginatedResult, ProductRow } from '@/domain/types';
import type { productSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export type ProductInsert = z.infer<typeof productSchema>;
export type ProductUpdate = Partial<ProductInsert>;

export async function findAll(
  branchId: number,
  includeDeleted = false,
  pagination?: PaginationOptions
): Promise<ProductRow[]> {
  const conditions = [eq(products.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  const limit = pagination?.limit;
  const offset = pagination?.offset;

  return db.query.products.findMany({
    where: and(...conditions),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit,
    offset,
  });
}

export async function findByIdForUpdate(
  branchId: number,
  id: number,
  includeDeleted = false,
  dbOrTx?: typeof db
): Promise<ProductRow | null> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const conditions = [eq(products.id, id), eq(products.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  const [result] = await client
    .select()
    .from(products)
    .where(and(...conditions))
    .for('update');

  return result ?? null;
}

export async function findById(
  branchId: number,
  id: number,
  includeDeleted = false
): Promise<ProductRow | null> {
  const conditions = [eq(products.id, id), eq(products.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  const result = await db.query.products.findFirst({
    where: and(...conditions),
  });
  return result ?? null;
}

export async function findByIds(
  branchId: number,
  ids: number[],
  includeDeleted = false,
  dbOrTx?: typeof db
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const conditions = [
    inArray(products.id, ids),
    eq(products.branchId, branchId),
  ];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  return client.query.products.findMany({
    where: and(...conditions),
  });
}

export async function findByIdsForUpdate(
  branchId: number,
  ids: number[],
  includeDeleted = false,
  dbOrTx?: typeof db
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const conditions = [
    inArray(products.id, ids),
    eq(products.branchId, branchId),
  ];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  return client
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.id))
    .for('update');
}

export async function findActive(branchId: number): Promise<ProductRow[]> {
  return db.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ),
    orderBy: (products, { asc }) => [asc(products.name)],
  });
}

export async function findDeletedInRange(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
): Promise<PaginatedResult<ProductRow>> {
  const conditions = [
    eq(products.branchId, branchId),
    isNotNull(products.deletedAt),
    gte(products.deletedAt, start),
    lte(products.deletedAt, end),
  ];

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(products)
    .where(and(...conditions));

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit,
    offset,
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: limit ?? total,
  };
}

export async function create(data: ProductInsert & { branchId: number }): Promise<ProductRow | undefined> {
  const [result] = await db
    .insert(products)
    .values({
      ...data,
      description: data.description ?? null,
      criticalSupplyType: data.criticalSupplyType ?? null,
      updatedAt: nowUTC(),
    })
    .returning();
  return result;
}

export async function update(
  branchId: number,
  id: number,
  data: ProductUpdate,
  dbOrTx?: typeof db
): Promise<ProductRow | null> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const [result] = await client
    .update(products)
    .set({
      ...data,
      updatedAt: nowUTC(),
    })
    .where(and(eq(products.id, id), eq(products.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function softDelete(branchId: number, id: number): Promise<ProductRow | null> {
  const [result] = await db
    .update(products)
    .set({
      isActive: false,
      deletedAt: nowUTC(),
      updatedAt: nowUTC(),
    })
    .where(and(eq(products.id, id), eq(products.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function restore(branchId: number, id: number): Promise<ProductRow | null> {
  const [result] = await db
    .update(products)
    .set({
      isActive: true,
      deletedAt: null,
      updatedAt: nowUTC(),
    })
    .where(and(eq(products.id, id), eq(products.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function hardDelete(
  branchId: number,
  id: number,
  dbOrTx?: typeof db
): Promise<ProductRow | null> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const [result] = await client
    .delete(products)
    .where(and(eq(products.id, id), eq(products.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function hardDeleteMany(
  branchId: number,
  ids: number[],
  dbOrTx?: typeof db
): Promise<ProductRow[]> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  return client
    .delete(products)
    .where(
      and(inArray(products.id, ids), eq(products.branchId, branchId))
    )
    .returning();
}

export async function lockForUpdate(
  dbOrTx: typeof db,
  ids: number[],
  branchId?: number
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  const conditions: ReturnType<typeof and>[] = [
    inArray(products.id, ids),
    isNull(products.deletedAt),
  ];

  if (branchId !== undefined) {
    conditions.push(eq(products.branchId, branchId));
  }

  return dbOrTx
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.id))
    .for('update');
}

export async function decrementStock(
  dbOrTx: typeof db,
  productId: number,
  quantity: number
): Promise<boolean> {
  const [updated] = await dbOrTx
    .update(products)
    .set({ stock: sql`${products.stock} - ${quantity}` })
    .where(and(eq(products.id, productId), gte(products.stock, quantity)))
    .returning({ id: products.id });

  return !!updated;
}

export async function incrementStock(
  dbOrTx: typeof db,
  productId: number,
  quantity: number
): Promise<void> {
  await dbOrTx
    .update(products)
    .set({ stock: sql`${products.stock} + ${quantity}` })
    .where(eq(products.id, productId));
}

export async function findByImageKey(
  imageKey: string,
  branchId?: number
): Promise<ProductRow | null> {
  const conditions: ReturnType<typeof and>[] = [
    eq(products.imageKey, imageKey),
    eq(products.isActive, true),
    isNull(products.deletedAt),
  ];

  if (branchId !== undefined) {
    conditions.push(eq(products.branchId, branchId));
  }

  const result = await db.query.products.findFirst({
    where: and(...conditions),
  });

  return result ?? null;
}

/**
 * Devuelve el conjunto de ids de productos que tienen referencias en
 * ventas, pedidos, recetas o movimientos, y por lo tanto no pueden
 * eliminarse permanentemente de forma segura.
 */
export async function findReferencedProductIds(
  dbOrTx: typeof db,
  productIds: number[]
): Promise<Set<number>> {
  const referencedIds = new Set<number>();

  if (productIds.length === 0) return referencedIds;

  const [saleItemsRows, orderItemsRows] = await Promise.all([
    dbOrTx
      .select({ productId: saleItems.productId })
      .from(saleItems)
      .where(inArray(saleItems.productId, productIds))
      .groupBy(saleItems.productId),
    dbOrTx
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .where(inArray(orderItems.productId, productIds))
      .groupBy(orderItems.productId),
  ]);

  const recipeRows = await dbOrTx
    .select({ supplyId: saleItemRecipes.supplyId })
    .from(saleItemRecipes)
    .where(inArray(saleItemRecipes.supplyId, productIds))
    .groupBy(saleItemRecipes.supplyId)
    .union(
      dbOrTx
        .select({ supplyId: orderItemRecipes.supplyId })
        .from(orderItemRecipes)
        .where(inArray(orderItemRecipes.supplyId, productIds))
        .groupBy(orderItemRecipes.supplyId)
    );

  const [reservationRows, movementRows, recipeAsSupplyRows] = await Promise.all([
    dbOrTx
      .select({ productId: orderStockReservations.productId })
      .from(orderStockReservations)
      .where(inArray(orderStockReservations.productId, productIds))
      .groupBy(orderStockReservations.productId),
    dbOrTx
      .select({ productId: stockMovements.productId })
      .from(stockMovements)
      .where(inArray(stockMovements.productId, productIds))
      .groupBy(stockMovements.productId),
    dbOrTx
      .select({ supplyId: recipes.supplyId })
      .from(recipes)
      .where(inArray(recipes.supplyId, productIds))
      .groupBy(recipes.supplyId),
  ]);

  for (const row of saleItemsRows) {
    if (row.productId !== null) referencedIds.add(row.productId);
  }
  for (const row of orderItemsRows) {
    if (row.productId !== null) referencedIds.add(row.productId);
  }
  for (const row of recipeRows) {
    referencedIds.add(row.supplyId);
  }
  for (const row of reservationRows) {
    if (row.productId !== null) referencedIds.add(row.productId);
  }
  for (const row of movementRows) {
    if (row.productId !== null) referencedIds.add(row.productId);
  }
  for (const row of recipeAsSupplyRows) {
    if (row.supplyId !== null) referencedIds.add(row.supplyId);
  }

  return referencedIds;
}
