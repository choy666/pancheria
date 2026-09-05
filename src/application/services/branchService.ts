import { and, count, eq, ilike, inArray, isNull, not, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  branches,
  cashRegisters,
  orderStockReservations,
  orders,
  products,
  recipes,
  sales,
  stockMovements,
  users,
  videos,
} from '@/db/schema';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { validateNonEmptyString } from '@/lib/validation-helpers';
import { validateOpeningHours } from '@/lib/branch-helpers';
import { nowUTC } from '@/lib/date';
import type { Branch, BranchOpeningHours } from '@/domain/types';

export async function listBranches(): Promise<Branch[]> {
  return db.query.branches.findMany({
    where: isNull(branches.deletedAt),
    orderBy: (branches, { desc }) => [desc(branches.createdAt)],
  }) as Promise<Branch[]>;
}

export async function getBranchById(id: number): Promise<Branch | undefined> {
  return db.query.branches.findFirst({
    where: and(eq(branches.id, id), isNull(branches.deletedAt)),
  }) as Promise<Branch | undefined>;
}

export async function createBranch(
  name: string,
  openingHours: BranchOpeningHours[] = [],
  address?: string | null,
  phone?: string | null,
  location?: string | null
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

  const existing = await db.query.branches.findFirst({
    where: and(eq(branches.name, trimmed), isNull(branches.deletedAt)),
  });

  if (existing) {
    throw new ValidationError('Ya existe una sucursal con ese nombre.');
  }

  const [branch] = await db
    .insert(branches)
    .values({
      name: trimmed,
      openingHours,
      address: address ?? null,
      phone: phone ?? null,
      location: location ?? null,
    })
    .returning();

  if (!branch) {
    throw new Error('No se pudo crear la sucursal.');
  }

  return branch as Branch;
}

export async function updateBranch(
  id: number,
  name: string,
  openingHours: BranchOpeningHours[] = [],
  address?: string | null,
  phone?: string | null,
  location?: string | null
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

  const branch = await getBranchById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  // Búsqueda case-insensitive para evitar nombres duplicados que difieran
  // solo en mayúsculas/minúsculas. Se filtran las sucursales eliminadas para
  // permitir reutilizar el nombre de una sucursal archivada.
  const existing = await db.query.branches.findFirst({
    where: and(
      ilike(branches.name, trimmed),
      not(eq(branches.id, id)),
      isNull(branches.deletedAt)
    ),
  });

  if (existing) {
    throw new ValidationError('Ya existe otra sucursal con ese nombre.');
  }

  const [updated] = await db
    .update(branches)
    .set({
      name: trimmed,
      openingHours,
      address: address ?? null,
      phone: phone ?? null,
      location: location ?? null,
    })
    .where(eq(branches.id, id))
    .returning();

  if (!updated) {
    throw new Error('No se pudo actualizar la sucursal.');
  }

  return updated as Branch;
}

export async function getBranchDeletionSummary(id: number) {
  const branch = await getBranchById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.branchId, id));
  const productIds = productRows.map((row) => row.id);

  const [
    productCount,
    saleCount,
    cashRegisterCount,
    stockMovementCount,
    userCount,
    recipeCount,
    orderCount,
    videoCount,
  ] = await Promise.all([
    Promise.resolve(productIds.length),
    db
      .select({ count: count() })
      .from(sales)
      .where(eq(sales.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(cashRegisters)
      .where(eq(cashRegisters.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(stockMovements)
      .where(eq(stockMovements.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
    productIds.length > 0
      ? db
          .select({ count: count() })
          .from(recipes)
          .where(
            or(
              inArray(recipes.compoundProductId, productIds),
              inArray(recipes.supplyId, productIds)
            )
          )
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(videos)
      .where(eq(videos.branchId, id))
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  return {
    branch: branch as Branch,
    counts: {
      products: productCount,
      sales: saleCount,
      cashRegisters: cashRegisterCount,
      stockMovements: stockMovementCount,
      users: userCount,
      recipes: recipeCount,
      orders: orderCount,
      videos: videoCount,
      total:
        productCount +
        saleCount +
        cashRegisterCount +
        stockMovementCount +
        userCount +
        recipeCount +
        orderCount +
        videoCount,
    },
  };
}

export async function deleteBranch(id: number) {
  const branch = await getBranchById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const orderRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.branchId, id), isNull(orders.deletedAt)));
  const orderIds = orderRows.map((row) => row.id);

  const deletedAt = nowUTC();

  await db.transaction(async (tx) => {
    if (orderIds.length > 0) {
      // Las reservas de pedidos que se archivan quedan huérfanas: se eliminan
      // para no bloquear stock de forma permanente.
      await tx
        .delete(orderStockReservations)
        .where(inArray(orderStockReservations.orderId, orderIds));
    }

    await tx
      .update(products)
      .set({ deletedAt })
      .where(and(eq(products.branchId, id), isNull(products.deletedAt)));

    await tx
      .update(cashRegisters)
      .set({ deletedAt })
      .where(and(eq(cashRegisters.branchId, id), isNull(cashRegisters.deletedAt)));

    await tx
      .update(orders)
      .set({ deletedAt })
      .where(and(eq(orders.branchId, id), isNull(orders.deletedAt)));

    await tx
      .update(videos)
      .set({ deletedAt })
      .where(and(eq(videos.branchId, id), isNull(videos.deletedAt)));

    const [updated] = await tx
      .update(branches)
      .set({ deletedAt })
      .where(eq(branches.id, id))
      .returning();

    if (!updated) {
      throw new Error('No se pudo archivar la sucursal.');
    }
  });

  return { ...branch, deletedAt } as Branch;
}
