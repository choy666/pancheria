import { and, count, eq, inArray, isNull, not, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  branches,
  cashRegisters,
  orderItemRecipes,
  orderItems,
  orderMessages,
  orders,
  orderStockReservations,
  products,
  recipes,
  saleItemRecipes,
  saleItems,
  salePayments,
  sales,
  stockMovements,
  users,
  videos,
} from '@/db/schema';

export type BranchInsert = typeof branches.$inferInsert;
export type BranchUpdate = Partial<BranchInsert>;

export async function findAllOrderedByCreatedAt(
  options: { limit?: number } = {}
) {
  return db.query.branches.findMany({
    orderBy: (branches, { desc }) => [desc(branches.createdAt)],
    limit: options.limit,
  });
}

export async function findById(id: number) {
  return db.query.branches.findFirst({
    where: eq(branches.id, id),
  });
}

export async function findByName(name: string) {
  return db.query.branches.findFirst({
    where: eq(branches.name, name),
  });
}

export async function findByNameCaseInsensitive(
  name: string,
  excludeId?: number
) {
  // Igualdad case-insensitive con lower(): `ilike` interpretaría `%` y `_`
  // del nombre como wildcards y produciría falsos positivos (p. ej. la
  // sucursal "Suc_1" colisionaría con "SucX1").
  const sameName = sql`lower(${branches.name}) = lower(${name})`;

  return db.query.branches.findFirst({
    where:
      excludeId === undefined
        ? sameName
        : and(sameName, not(eq(branches.id, excludeId))),
  });
}

export async function insert(values: BranchInsert) {
  const [row] = await db.insert(branches).values(values).returning();
  return row ?? null;
}

export async function update(id: number, values: BranchUpdate) {
  const [row] = await db
    .update(branches)
    .set(values)
    .where(eq(branches.id, id))
    .returning();
  return row ?? null;
}

export async function findProductIdsByBranch(branchId: number) {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.branchId, branchId));
  return rows.map((row) => row.id);
}

export async function findProductImageKeysByBranch(branchId: number) {
  const rows = await db
    .select({ id: products.id, imageKey: products.imageKey })
    .from(products)
    .where(eq(products.branchId, branchId));
  return rows;
}

export async function findUsernamesByBranch(branchId: number) {
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.branchId, branchId));
  return rows.map((row) => row.username);
}

export async function findOrderIdsByBranch(branchId: number) {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.branchId, branchId));
  return rows.map((row) => row.id);
}

export async function findAttachmentKeysByOrderIds(orderIds: number[]) {
  if (orderIds.length === 0) {
    return [] as string[];
  }

  const rows = await db
    .select({ attachmentKey: orderMessages.attachmentKey })
    .from(orderMessages)
    .where(inArray(orderMessages.orderId, orderIds));

  return rows
    .map((row) => row.attachmentKey)
    .filter((key): key is string => Boolean(key));
}

export async function findVideoFileUrlsByBranch(branchId: number) {
  const rows = await db
    .select({ fileUrl: videos.fileUrl })
    .from(videos)
    .where(eq(videos.branchId, branchId));

  return rows
    .map((row) => row.fileUrl)
    .filter((url): url is string => Boolean(url));
}

export async function countBranchDeletionImpact(
  branchId: number,
  productIds: number[]
) {
  const [
    saleCount,
    cashRegisterCount,
    stockMovementCount,
    userCount,
    recipeCount,
    orderCount,
    videoCount,
    openCashRegisterCount,
    activeOrderCount,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(sales)
      .where(eq(sales.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(cashRegisters)
      .where(eq(cashRegisters.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(stockMovements)
      .where(eq(stockMovements.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.branchId, branchId))
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
      .where(eq(orders.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(videos)
      .where(eq(videos.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
    // Señales de riesgo para el diálogo de eliminación: una caja abierta o
    // pedidos en curso implican trabajo activo que la cascada borra.
    db
      .select({ count: count() })
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.branchId, branchId),
          eq(cashRegisters.status, 'open'),
          isNull(cashRegisters.deletedAt)
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.branchId, branchId),
          inArray(orders.status, ['pending', 'in_process']),
          isNull(orders.deletedAt)
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  return {
    products: productIds.length,
    sales: saleCount,
    cashRegisters: cashRegisterCount,
    stockMovements: stockMovementCount,
    users: userCount,
    recipes: recipeCount,
    orders: orderCount,
    videos: videoCount,
    openCashRegisters: openCashRegisterCount,
    activeOrders: activeOrderCount,
  };
}

/**
 * Cuenta los registros hijos que la cascada de borrado elimina vía
 * `ON DELETE CASCADE` (ítems, pagos, recetas aplicadas, mensajes y
 * reservas). `countBranchDeletionImpact` informa solo las entidades de
 * primer nivel; sin esta suma el total del resumen subestima el daño real.
 */
export async function countDeletionCascadeChildren(branchId: number) {
  const [saleRows, orderIds] = await Promise.all([
    db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.branchId, branchId)),
    findOrderIdsByBranch(branchId),
  ]);
  const saleIds = saleRows.map((row) => row.id);

  // Las recetas aplicadas cuelgan de los ítems, no de la venta o el pedido:
  // hay que resolver los ids de ítems un nivel antes para contarlas.
  const [saleItemRows, orderItemRows] = await Promise.all([
    saleIds.length > 0
      ? db
          .select({ id: saleItems.id })
          .from(saleItems)
          .where(inArray(saleItems.saleId, saleIds))
      : Promise.resolve([]),
    orderIds.length > 0
      ? db
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
      : Promise.resolve([]),
  ]);
  const saleItemIds = saleItemRows.map((row) => row.id);
  const orderItemIds = orderItemRows.map((row) => row.id);

  const [
    saleItemCount,
    salePaymentCount,
    saleItemRecipeCount,
    orderItemCount,
    orderItemRecipeCount,
    orderMessageCount,
    orderStockReservationCount,
  ] = await Promise.all([
    saleIds.length > 0
      ? db
          .select({ count: count() })
          .from(saleItems)
          .where(inArray(saleItems.saleId, saleIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    saleIds.length > 0
      ? db
          .select({ count: count() })
          .from(salePayments)
          .where(inArray(salePayments.saleId, saleIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    saleItemIds.length > 0
      ? db
          .select({ count: count() })
          .from(saleItemRecipes)
          .where(inArray(saleItemRecipes.saleItemId, saleItemIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    orderIds.length > 0
      ? db
          .select({ count: count() })
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    orderItemIds.length > 0
      ? db
          .select({ count: count() })
          .from(orderItemRecipes)
          .where(inArray(orderItemRecipes.orderItemId, orderItemIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    orderIds.length > 0
      ? db
          .select({ count: count() })
          .from(orderMessages)
          .where(inArray(orderMessages.orderId, orderIds))
          .then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    // Las reservas tienen branchId propio: se cuentan directo, sin join.
    db
      .select({ count: count() })
      .from(orderStockReservations)
      .where(eq(orderStockReservations.branchId, branchId))
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  return {
    saleItems: saleItemCount,
    salePayments: salePaymentCount,
    saleItemRecipes: saleItemRecipeCount,
    orderItems: orderItemCount,
    orderItemRecipes: orderItemRecipeCount,
    orderMessages: orderMessageCount,
    orderStockReservations: orderStockReservationCount,
  };
}

export async function countBranches() {
  const rows = await db.select({ count: count() }).from(branches);
  return rows[0]?.count ?? 0;
}

/**
 * Elimina en cascada todos los registros asociados a una sucursal dentro de
 * la transacción recibida. La liberación de archivos (imágenes, adjuntos y
 * videos) queda a cargo del llamador y debe ejecutarse después del commit.
 */
export async function deleteCascade(
  tx: typeof db,
  branchId: number,
  productIds: number[]
) {
  const saleRows = await tx
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.branchId, branchId));
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

  await tx.delete(stockMovements).where(eq(stockMovements.branchId, branchId));

  // Eliminación en cascada de pedidos, mensajes, items y reservas.
  await tx.delete(orders).where(eq(orders.branchId, branchId));

  await tx.delete(sales).where(eq(sales.branchId, branchId));
  await tx.delete(cashRegisters).where(eq(cashRegisters.branchId, branchId));
  await tx.delete(videos).where(eq(videos.branchId, branchId));
  await tx.delete(products).where(eq(products.branchId, branchId));
  await tx.delete(users).where(eq(users.branchId, branchId));
  await tx.delete(branches).where(eq(branches.id, branchId));
}
