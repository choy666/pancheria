import { eq, and, isNull, count, lt, inArray, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { orders, orderItems, orderMessages } from '@/db/schema';
import type { OrderStatus, OrderWithItems, OrderWithUnreadCount } from '@/domain/types';

export async function findByIdWithToken(
  orderId: number,
  token: string
): Promise<(typeof orders.$inferSelect) | undefined> {
  return db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.cancellationToken, token),
      isNull(orders.deletedAt)
    ),
  });
}

export async function findByIdWithTokenForUpdate(
  tx: typeof db,
  orderId: number,
  token: string
): Promise<(typeof orders.$inferSelect) | undefined> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.cancellationToken, token),
        isNull(orders.deletedAt)
      )
    )
    .for('update');

  return order;
}

export async function findByIdForUpdate(
  tx: typeof db,
  branchId: number,
  orderId: number
): Promise<(typeof orders.$inferSelect) | undefined> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.branchId, branchId), isNull(orders.deletedAt))
    )
    .for('update');

  return order;
}

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
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: OrderWithUnreadCount[]; total: number; page: number; limit: number }> {
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

  if (options.search?.trim()) {
    const search = options.search.trim();
    conditions.push(
      or(
        ilike(orders.customerName, `%${search}%`),
        ilike(orders.customerPhone, `%${search}%`)
      )!
    );
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

  const orderIds = items.map((item) => item.id);
  const unreadRows = orderIds.length
    ? await db.query.orderMessages.findMany({
        where: and(
          inArray(orderMessages.orderId, orderIds),
          eq(orderMessages.senderType, 'client'),
          isNull(orderMessages.readAt)
        ),
        columns: { orderId: true },
      })
    : [];

  const unreadByOrderId = new Map<number, number>();
  for (const row of unreadRows) {
    unreadByOrderId.set(row.orderId, (unreadByOrderId.get(row.orderId) ?? 0) + 1);
  }

  const itemsWithUnread = items.map((item) => ({
    ...item,
    unreadCount: unreadByOrderId.get(item.id) ?? 0,
  })) as OrderWithUnreadCount[];

  return {
    items: itemsWithUnread,
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
    throw new Error('No se pudo cancelar el pedido.');
  }

  return updated;
}

export async function findByOrderNumberAndCustomer(
  orderNumber: string,
  customerName?: string,
  customerPhone?: string
): Promise<OrderWithItems | undefined> {
  const conditions: ReturnType<typeof and>[] = [
    eq(orders.orderNumber, orderNumber),
    isNull(orders.deletedAt),
  ];

  if (customerName?.trim()) {
    conditions.push(eq(orders.customerName, customerName.trim()));
  }

  if (customerPhone?.trim()) {
    conditions.push(eq(orders.customerPhone, customerPhone.trim().replace(/\s/g, '')));
  }

  return (await db.query.orders.findFirst({
    where: and(...conditions),
    with: { branch: true, items: { with: { product: true } } },
  })) as OrderWithItems | undefined;
}
