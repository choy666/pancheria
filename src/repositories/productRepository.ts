import { eq, inArray, isNull, and } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { ProductRow } from '@/domain/types';
import type { productSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type ProductInsert = z.infer<typeof productSchema>;
export type ProductUpdate = Partial<ProductInsert>;

export async function findAll(
  branchId: number,
  includeDeleted = false
): Promise<ProductRow[]> {
  const conditions = [eq(products.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  return db.query.products.findMany({
    where: and(...conditions),
    orderBy: (products, { asc }) => [asc(products.name)],
  });
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
  dbOrTx: typeof db = db
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  const conditions = [
    inArray(products.id, ids),
    eq(products.branchId, branchId),
  ];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  return dbOrTx.query.products.findMany({
    where: and(...conditions),
  });
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
  data: ProductUpdate
): Promise<ProductRow | null> {
  const [result] = await db
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
