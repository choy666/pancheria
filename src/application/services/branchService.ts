import { and, count, eq, ilike, inArray, not, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  branches,
  cashRegisters,
  dailyClosures,
  products,
  recipes,
  saleItems,
  sales,
  stockMovements,
  users,
} from '@/db/schema';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { validateNonEmptyString } from '@/lib/validation-helpers';
import { validateOpeningHours } from '@/lib/branch-helpers';
import type { Branch, BranchOpeningHours } from '@/domain/types';

export async function listBranches() {
  return db.query.branches.findMany({
    orderBy: (branches, { desc }) => [desc(branches.createdAt)],
  });
}

export async function getBranchById(id: number) {
  return db.query.branches.findFirst({
    where: eq(branches.id, id),
  });
}

export async function createBranch(
  name: string,
  openingHours: BranchOpeningHours[] = []
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

  const existing = await db.query.branches.findFirst({
    where: eq(branches.name, trimmed),
  });

  if (existing) {
    throw new ValidationError('Ya existe una sucursal con ese nombre.');
  }

  const [branch] = await db
    .insert(branches)
    .values({ name: trimmed, openingHours })
    .returning();

  if (!branch) {
    throw new Error('No se pudo crear la sucursal.');
  }

  return branch as Branch;
}

export async function updateBranch(
  id: number,
  name: string,
  openingHours: BranchOpeningHours[] = []
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, id),
  });

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  // Búsqueda case-insensitive para evitar nombres duplicados que difieran
  // solo en mayúsculas/minúsculas. Esto supera la validación del índice
  // unique nativo de PostgreSQL, que es case-sensitive. Si se desea
  // reforzar la unicidad a nivel de base de datos, es necesario migrar la
  // columna `name` a un tipo case-insensitive (como `citext`) o agregar un
  // índice unique sobre una expresión en minúsculas (`lower(name)`).
  const existing = await db.query.branches.findFirst({
    where: and(ilike(branches.name, trimmed), not(eq(branches.id, id))),
  });

  if (existing) {
    throw new ValidationError('Ya existe otra sucursal con ese nombre.');
  }

  const [updated] = await db
    .update(branches)
    .set({ name: trimmed, openingHours })
    .where(eq(branches.id, id))
    .returning();

  if (!updated) {
    throw new Error('No se pudo actualizar la sucursal.');
  }

  return updated as Branch;
}

export async function getBranchDeletionSummary(id: number) {
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, id),
  });

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
    dailyClosureCount,
    stockMovementCount,
    userCount,
    recipeCount,
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
      .from(dailyClosures)
      .where(eq(dailyClosures.branchId, id))
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
  ]);

  return {
    branch,
    counts: {
      products: productCount,
      sales: saleCount,
      cashRegisters: cashRegisterCount,
      dailyClosures: dailyClosureCount,
      stockMovements: stockMovementCount,
      users: userCount,
      recipes: recipeCount,
      total:
        productCount +
        saleCount +
        cashRegisterCount +
        dailyClosureCount +
        stockMovementCount +
        userCount +
        recipeCount,
    },
  };
}

export async function deleteBranch(id: number) {
  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, id),
  });

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  await db.transaction(async (tx) => {
    const productRows = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.branchId, id));
    const productIds = productRows.map((row) => row.id);

    const saleRows = await tx
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.branchId, id));
    const saleIds = saleRows.map((row) => row.id);

    if (productIds.length > 0) {
      await tx
        .delete(recipes)
        .where(
          or(
            inArray(recipes.compoundProductId, productIds),
            inArray(recipes.supplyId, productIds)
          )
        );
    }

    if (saleIds.length > 0) {
      await tx.delete(saleItems).where(inArray(saleItems.saleId, saleIds));
    }

    await tx
      .delete(stockMovements)
      .where(eq(stockMovements.branchId, id));

    await tx.delete(sales).where(eq(sales.branchId, id));
    await tx.delete(cashRegisters).where(eq(cashRegisters.branchId, id));
    await tx.delete(dailyClosures).where(eq(dailyClosures.branchId, id));
    await tx.delete(products).where(eq(products.branchId, id));
    await tx.delete(users).where(eq(users.branchId, id));
    await tx.delete(branches).where(eq(branches.id, id));
  });

  return branch;
}
