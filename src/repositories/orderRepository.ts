import { eq, and, isNull, count, lt } from 'drizzle-orm';
import { db } from '@/db';
import { orders, orderItems } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { OrderStatus } from '@/domain/types';
import type { OrderWithItems } from '@/domain/types';

export async function findById(
  branchId: number,
  id: number
): Promise<OrderWithItems | undefined> {
  return (await db.query.orders.findFirst({
    where: and(
      eq(orders.id, id),
      eq(orders.branchId, branchId),
      isNull(orders.deletedAt)
    ),
    with: {
      branch: true,
      items: { with: { product: true } },
    },
  })) as OrderWithItems | undefined;
}

export async function findByIdForCancel(
  branchId: number,
  id: number
): Promise<(OrderWithItems & { items: { productId: number; quantity: number }[] }) | undefined> {
  return (await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.branchId, branchId), isNull(orders.deletedAt)),
    with: { branch: true, items: true },
  })) as (OrderWithItems & { items: { productId: number; quantity: number }[] }) | undefined;
}

export async function findByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderWithItems | null> {
  const order = (await db.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key),
      isNull(orders.deletedAt)
    ),
    with: {
      branch: true,
      items: { with: { product: true } },
    },
  })) as OrderWithItems | undefined;

  return order ?? null;
}

export async function findPending(branchId: number): Promise<OrderWithItems[]> {
  return (await db.query.orders.findMany({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.status, 'pending'),
      isNull(orders.deletedAt)
    ),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    with: { branch: true, items: { with: { product: true } } },
  })) as OrderWithItems[];
}

export async function findOrders(
  branchId: number,
  options: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: OrderWithItems[]; total: number; page: number; limit: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(orders.branchId, branchId),
    isNull(orders.deletedAt),
  ];

  if (options.status) {
    conditions.push(eq(orders.status, options.status));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(...conditions));

  const items = (await db.query.orders.findMany({
    where: and(...conditions),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    limit,
    offset,
    with: { branch: true, items: { with: { product: true } } },
  })) as OrderWithItems[];

  return {
    items,
    total: Number(total),
    page,
    limit,
  };
}

export async function findExpiredPending(
  branchId: number,
  expirationDate: Date
): Promise<OrderWithItems[]> {
  return (await db.query.orders.findMany({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.status, 'pending'),
      isNull(orders.deletedAt),
      lt(orders.createdAt, expirationDate)
    ),
    with: { items: true },
  })) as OrderWithItems[];
}

export async function findExpiredPendingAll(
  expirationDate: Date
): Promise<OrderWithItems[]> {
  return (await db.query.orders.findMany({
    where: and(
      eq(orders.status, 'pending'),
      isNull(orders.deletedAt),
      lt(orders.createdAt, expirationDate)
    ),
    with: { items: true },
  })) as OrderWithItems[];
}

export async function insertOrder(
  tx: typeof db,
  values: typeof orders.$inferInsert
): Promise<typeof orders.$inferSelect> {
  const [order] = await tx.insert(orders).values(values).returning();
  if (!order) throw new Error('No se pudo crear el pedido.');
  return order;
}

export async function insertOrderItems(
  tx: typeof db,
  values: (typeof orderItems.$inferInsert)[]
): Promise<void> {
  await tx.insert(orderItems).values(values);
}

export async function updateStatus(
  tx: typeof db,
  branchId: number,
  id: number,
  values: Partial<typeof orders.$inferInsert>
): Promise<typeof orders.$inferSelect> {
  const [updated] = await tx
    .update(orders)
    .set(values)
    .where(and(eq(orders.id, id), eq(orders.branchId, branchId)))
    .returning();

  if (!updated) {
    throw new Error('No se pudo actualizar el pedido.');
  }

  return updated;
}

export async function cancel(
  branchId: number,
  id: number,
  values: Partial<typeof orders.$inferInsert>
): Promise<typeof orders.$inferSelect> {
  const [updated] = await db
    .update(orders)
    .set(values)
    .where(and(eq(orders.id, id), eq(orders.branchId, branchId)))
    .returning();

  if (!updated) {
    throw new Error('No se pudo cancelar el pedido.');
  }

  return updated;
}

export async function markOrderAsSent(
  branchId: number,
  id: number
): Promise<typeof orders.$inferSelect | undefined> {
  const [updated] = await db
    .update(orders)
    .set({ sentAt: nowUTC() })
    .where(
      and(
        eq(orders.id, id),
        eq(orders.branchId, branchId),
        eq(orders.status, 'pending'),
        isNull(orders.deletedAt),
        isNull(orders.sentAt)
      )
    )
    .returning();

  return updated;
}
