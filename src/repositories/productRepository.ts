import {
  eq,
  inArray,
  isNull,
  isNotNull,
  and,
  not,
  notInArray,
  gte,
  lte,
  count,
  asc,
  sql,
} from 'drizzle-orm';
import { db } from '@/db';
import {
  products,
  orderItems,
  orders,
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

/**
 * Busca un producto activo por nombre exacto sin distinguir
 * mayúsculas/minúsculas ni espacios en los bordes — espejo del índice
 * parcial `products_branch_name_lower_uniq` (deleted_at IS NULL).
 */
export async function findByNameCaseInsensitive(
  branchId: number,
  name: string,
  excludeId?: number
): Promise<ProductRow | null> {
  const conditions = [
    eq(products.branchId, branchId),
    isNull(products.deletedAt),
    sql`lower(btrim(${products.name})) = lower(btrim(${name}))`,
  ];
  if (excludeId !== undefined) {
    conditions.push(not(eq(products.id, excludeId)));
  }

  const client = getCurrentTransaction() ?? db;
  const result = await client.query.products.findFirst({
    where: and(...conditions),
  });
  return result ?? null;
}

export async function findById(
  branchId: number,
  id: number,
  includeDeleted = false,
  dbOrTx?: typeof db
): Promise<ProductRow | null> {
  const conditions = [eq(products.id, id), eq(products.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(products.deletedAt));
  }

  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const result = await client.query.products.findFirst({
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

export async function findActivePage(
  branchId: number,
  pagination: PaginationParams
): Promise<PaginatedResult<ProductRow>> {
  const conditions = [
    eq(products.branchId, branchId),
    eq(products.isActive, true),
    isNull(products.deletedAt),
  ];

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(products)
    .where(and(...conditions));

  const items = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return {
    items,
    total: Number(total),
    page: pagination.page,
    limit: pagination.limit,
  };
}

/**
 * Insumos activos (`critical_supply`/`manual_supply`) paginados: el listado
 * de stock del panel. El filtro por tipo vive en la consulta para que
 * `total` refleje los insumos y no todo el catálogo.
 */
export async function findActiveSuppliesPage(
  branchId: number,
  pagination: PaginationParams
): Promise<PaginatedResult<ProductRow>> {
  const conditions = [
    eq(products.branchId, branchId),
    eq(products.isActive, true),
    isNull(products.deletedAt),
    inArray(products.type, ['critical_supply', 'manual_supply']),
  ];

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(products)
    .where(and(...conditions));

  const items = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return {
    items,
    total: Number(total),
    page: pagination.page,
    limit: pagination.limit,
  };
}

export async function findActiveCriticalSupplies(
  branchId: number,
  dbOrTx?: typeof db
): Promise<ProductRow[]> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  return client.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      eq(products.type, 'critical_supply'),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ),
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

/**
 * Filas de productos en papelera por ids. `emptyTrash` la usa para
 * procesar lotes estables: los ids se resuelven una vez al inicio y los
 * chunks no se ven afectados por las filas que ya se eliminaron.
 */
export async function findDeletedByIds(
  branchId: number,
  ids: number[]
): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  return db.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      inArray(products.id, ids),
      isNotNull(products.deletedAt)
    ),
    orderBy: (products, { asc }) => [asc(products.name)],
  });
}

export async function create(
  data: ProductInsert & { branchId: number },
  dbOrTx?: typeof db
): Promise<ProductRow | undefined> {
  const client = dbOrTx ?? getCurrentTransaction() ?? db;
  const [result] = await client
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

/**
 * Devuelve todas las `image_key` referenciadas por productos (incluye
 * eliminados: la imagen se conserva hasta el hard-delete). La usa el
 * cleanup de archivos huérfanos para no borrar imágenes vivas.
 */
export async function findAllImageKeys(
  options: { limit?: number; offset?: number } = {}
): Promise<string[]> {
  let query = db
    .select({ imageKey: products.imageKey })
    .from(products)
    .where(isNotNull(products.imageKey))
    .$dynamic();

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options.offset !== undefined) {
    query = query.offset(options.offset);
  }

  const rows = await query;

  return rows.map((row) => row.imageKey as string);
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
    // `imageKey` no es unique: orden determinista ante colisiones.
    orderBy: (products, { asc }) => [asc(products.id)],
  });

  return result ?? null;
}

/**
 * Ids de todos los productos en papelera dentro del rango. `emptyTrash`
 * lo usa para saber qué compuestos mueren en la misma corrida y no
 * bloquear insumos por recetas que también van a desaparecer.
 */
export async function findDeletedIdsInRange(
  branchId: number,
  start: Date,
  end: Date
): Promise<number[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.branchId, branchId),
        isNotNull(products.deletedAt),
        gte(products.deletedAt, start),
        lte(products.deletedAt, end)
      )
    );

  return rows.map((row) => row.id);
}

/**
 * Productos presentes en pedidos abiertos (`pending`/`in_process`).
 * Bloquea el purge: cobrar un pedido que referencia un producto
 * inexistente rompería la conversión a venta. Los pedidos cerrados,
 * cancelados o en papelera no bloquean — sus ítems viajan con snapshot.
 */
export async function findProductIdsInOpenOrders(
  dbOrTx: typeof db,
  productIds: number[]
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (productIds.length === 0) return ids;

  const rows = await dbOrTx
    .select({ productId: orderItems.productId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        inArray(orderItems.productId, productIds),
        inArray(orders.status, ['pending', 'in_process']),
        isNull(orders.deletedAt)
      )
    )
    .groupBy(orderItems.productId);

  for (const row of rows) {
    if (row.productId !== null) ids.add(row.productId);
  }

  return ids;
}

/**
 * Productos usados como insumo (`supply_id`) en la receta de un compuesto
 * que NO se está eliminando en esta misma purga. Bloquea el purge porque
 * el `onDelete: cascade` de `recipes.supply_id` borraría la fila de la
 * receta y mutilaría silenciosamente al compuesto — incluso si está en
 * papelera, una restauración posterior lo devolvería sin receta.
 *
 * `excludeCompoundIds` es el conjunto de compuestos que se eliminan en la
 * misma corrida (toda la papelera en `emptyTrash`, el propio producto en
 * el borrado individual): sus recetas desaparecen por la cascada de
 * `compound_product_id`, así que no deben bloquear al insumo.
 */
export async function findProductIdsUsedByRecipes(
  dbOrTx: typeof db,
  productIds: number[],
  excludeCompoundIds: number[] = []
): Promise<Set<number>> {
  const ids = new Set<number>();
  if (productIds.length === 0) return ids;

  const conditions = [inArray(recipes.supplyId, productIds)];
  if (excludeCompoundIds.length > 0) {
    conditions.push(notInArray(recipes.compoundProductId, excludeCompoundIds));
  }

  const rows = await dbOrTx
    .select({ supplyId: recipes.supplyId })
    .from(recipes)
    .where(and(...conditions))
    .groupBy(recipes.supplyId);

  for (const row of rows) {
    ids.add(row.supplyId);
  }

  return ids;
}
