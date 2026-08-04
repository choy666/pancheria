import { eq, inArray, isNull, and } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import type { ProductRow } from '@/domain/types';
import type { productSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type ProductInsert = z.infer<typeof productSchema>;
export type ProductUpdate = Partial<ProductInsert>;

export async function findAll(includeDeleted = false): Promise<ProductRow[]> {
  const conditions = includeDeleted ? undefined : isNull(products.deletedAt);

  return db.query.products.findMany({
    where: conditions,
    orderBy: (products, { asc }) => [asc(products.name)],
  });
}

export async function findById(id: number, includeDeleted = false): Promise<ProductRow | null> {
  const result = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      includeDeleted ? undefined : isNull(products.deletedAt)
    ),
  });
  return result ?? null;
}

export async function findByIds(ids: number[], includeDeleted = false): Promise<ProductRow[]> {
  if (ids.length === 0) return [];

  return db.query.products.findMany({
    where: and(
      inArray(products.id, ids),
      includeDeleted ? undefined : isNull(products.deletedAt)
    ),
  });
}

export async function findActive(): Promise<ProductRow[]> {
  return db.query.products.findMany({
    where: and(eq(products.isActive, true), isNull(products.deletedAt)),
    orderBy: (products, { asc }) => [asc(products.name)],
  });
}

export async function create(data: ProductInsert): Promise<ProductRow | undefined> {
  const [result] = await db
    .insert(products)
    .values({
      ...data,
      description: data.description ?? null,
      criticalSupplyType: data.criticalSupplyType ?? null,
      updatedAt: new Date(),
    })
    .returning();
  return result;
}

export async function update(id: number, data: ProductUpdate): Promise<ProductRow | null> {
  const [result] = await db
    .update(products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  return result ?? null;
}

export async function softDelete(id: number): Promise<ProductRow | null> {
  const [result] = await db
    .update(products)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  return result ?? null;
}

export async function restore(id: number): Promise<ProductRow | null> {
  const [result] = await db
    .update(products)
    .set({
      isActive: true,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  return result ?? null;
}
