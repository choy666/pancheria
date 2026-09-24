import {
  eq,
  and,
  isNull,
  count,
  lt,
  inArray,
  notInArray,
  ilike,
  or,
} from 'drizzle-orm';
import { db } from '@/db';
import { orders, orderItems, orderItemRecipes, orderMessages } from '@/db/schema';
import { DomainError } from '@/domain/errors';
import type { OrderStatus, OrderWithItems, OrderWithUnreadCount, OrderItem, RecipeItemConfig } from '@/domain/types';

export type OrderItemRecipeInsert = typeof orderItemRecipes.$inferInsert;
export type OrderIdempotencyLookup = {
  order: OrderWithItems;
  idempotencyHash: string | null;
};

function stripIdempotencyHash<T extends object>(
  order: T
): Omit<T, 'idempotencyHash'> {
  const safeOrder = { ...order } as T & { idempotencyHash?: string | null };
  delete safeOrder.idempotencyHash;
  return safeOrder as Omit<T, 'idempotencyHash'>;
}

function normalizeOrder(
  order: (typeof orders.$inferSelect & {
    branch?: unknown;
    items?: (typeof orderItems.$inferSelect & {
      product?: unknown;
      recipeSnapshots?: unknown[];
    })[];
  })
): OrderWithItems {
  const safeOrder = stripIdempotencyHash(order);
  return {
    ...safeOrder,
    items: (order.items ?? []).map((item) => normalizeOrderItem(item)),
  } as OrderWithItems;
}

function normalizeOrderItem(
  item: (typeof orderItems.$inferSelect & {
    product?: unknown;
    recipeSnapshots?: unknown[];
  })
): OrderItem {
  const { recipeSnapshots, ...rest } = item;
  return {
    ...rest,
    recipeSnapshot: recipeSnapshots
      ? (recipeSnapshots as unknown as RecipeItemConfig[])
      : undefined,
  } as OrderItem;
}

export async function findByIdWithToken(
  orderId: number,
  token: string
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'> | undefined> {
  return db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.cancellationToken, token),
      isNull(orders.deletedAt)
    ),
    columns: { idempotencyHash: false },
  });
}

export async function findByIdWithTokenForUpdate(
  tx: typeof db,
  orderId: number,
  token: string
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'> | undefined> {
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

  if (!order) return undefined;
  const safeOrder = stripIdempotencyHash(order);
  return safeOrder;
}

export async function findByIdForUpdate(
  tx: typeof db,
  branchId: number,
  orderId: number
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'> | undefined> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.branchId, branchId), isNull(orders.deletedAt))
    )
    .for('update');

  if (!order) return undefined;
  const safeOrder = stripIdempotencyHash(order);
  return safeOrder;
}

export async function findById(
  branchId: number,
  id: number
): Promise<OrderWithItems | undefined> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, id),
      eq(orders.branchId, branchId),
      isNull(orders.deletedAt)
    ),
    with: {
      branch: true,
      items: { with: { product: true, recipeSnapshots: true } },
    },
  });

  if (!order) return undefined;

  return normalizeOrder(order);
}

/**
 * Estado mínimo del pedido para el stream SSE de chat. Valida el scope
 * (`branchId` del operador o `token` del cliente) y evita cargar ítems ni
 * relaciones: es la query que corre en cada tick del poll interno.
 */
export async function findChatStreamState(
  orderId: number,
  scope: { branchId: number } | { token: string }
): Promise<
  | {
      status: (typeof orders.$inferSelect)['status'];
      deliveryType: (typeof orders.$inferSelect)['deliveryType'];
      createdAt: Date;
      branchId: number;
    }
  | undefined
> {
  const conditions = [eq(orders.id, orderId), isNull(orders.deletedAt)];

  if ('branchId' in scope) {
    conditions.push(eq(orders.branchId, scope.branchId));
  } else {
    conditions.push(eq(orders.cancellationToken, scope.token));
  }

  return db.query.orders.findFirst({
    where: and(...conditions),
    columns: {
      status: true,
      deliveryType: true,
      createdAt: true,
      branchId: true,
    },
  });
}

export async function findByIdForCancel(
  branchId: number,
  id: number
): Promise<(OrderWithItems & { items: { productId: number; quantity: number }[] }) | undefined> {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.branchId, branchId), isNull(orders.deletedAt)),
    with: { branch: true, items: true },
  });

  if (!order) return undefined;
  const safeOrder = stripIdempotencyHash(order);
  return safeOrder as OrderWithItems & { items: { productId: number; quantity: number }[] };
}

export async function findByIdempotencyKey(
  branchId: number,
  key: string
): Promise<OrderIdempotencyLookup | null> {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key),
      isNull(orders.deletedAt)
    ),
    with: {
      branch: true,
      items: { with: { product: true, recipeSnapshots: true } },
    },
  });

  return order
    ? { order: normalizeOrder(order), idempotencyHash: order.idempotencyHash }
    : null;
}

export async function findPending(branchId: number): Promise<OrderWithItems[]> {
  const ordersList = await db.query.orders.findMany({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.status, 'pending'),
      isNull(orders.deletedAt)
    ),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    with: { branch: true, items: { with: { product: true, recipeSnapshots: true } } },
  });

  return ordersList.map((order) => normalizeOrder(order));
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

  const rawItems = (await db.query.orders.findMany({
    where: and(...conditions),
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    limit,
    offset,
    with: { branch: true, items: { with: { product: true, recipeSnapshots: true } } },
  })) as (typeof orders.$inferSelect & { branch: unknown; items: (typeof orderItems.$inferSelect & { product?: unknown; recipeSnapshots?: unknown[] })[] })[];

  const items = rawItems.map((order) => normalizeOrder(order));

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

export async function countOrdersByStatus(
  branchId: number
): Promise<Record<OrderStatus, number>> {
  const rows = await db
    .select({
      status: orders.status,
      count: count(),
    })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), isNull(orders.deletedAt)))
    .groupBy(orders.status);

  const result: Record<OrderStatus, number> = {
    pending: 0,
    in_process: 0,
    paid: 0,
    finished: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    if (row.status) {
      result[row.status] = Number(row.count);
    }
  }

  return result;
}

/**
 * Devuelve los identificadores de pedidos `pending` vencidos, ordenados por
 * antigüedad y acotados por `limit`. `excludeIds` permite saltear pedidos ya
 * intentados dentro de una misma corrida de expiración.
 */
export async function findExpiredPendingIds(
  expirationDate: Date,
  options: { branchId?: number; limit?: number; excludeIds?: number[] } = {}
): Promise<{ id: number; branchId: number }[]> {
  const conditions = [
    eq(orders.status, 'pending'),
    isNull(orders.deletedAt),
    lt(orders.createdAt, expirationDate),
  ];

  if (options.branchId !== undefined) {
    conditions.push(eq(orders.branchId, options.branchId));
  }

  if (options.excludeIds && options.excludeIds.length > 0) {
    conditions.push(notInArray(orders.id, options.excludeIds));
  }

  return db.query.orders.findMany({
    columns: { id: true, branchId: true },
    where: and(...conditions),
    orderBy: (o, { asc }) => [asc(o.createdAt)],
    limit: options.limit ?? 200,
  });
}

/**
 * Cantidad de pedidos `pending` vencidos a la fecha de corte. Se usa para
 * reportar el trabajo restante cuando una corrida de expiración se corta
 * por presupuesto de tiempo.
 */
export async function countExpiredPending(
  expirationDate: Date,
  options: { branchId?: number } = {}
): Promise<number> {
  const conditions = [
    eq(orders.status, 'pending'),
    isNull(orders.deletedAt),
    lt(orders.createdAt, expirationDate),
  ];

  if (options.branchId !== undefined) {
    conditions.push(eq(orders.branchId, options.branchId));
  }

  const [row] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(...conditions));

  return row?.count ?? 0;
}

export async function insertOrder(
  tx: typeof db,
  values: typeof orders.$inferInsert
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'>> {
  const [order] = await tx.insert(orders).values(values).returning();
  if (!order) throw new DomainError('No se pudo crear el pedido.');
  return stripIdempotencyHash(order);
}

/**
 * Inserta un pedido de forma idempotente usando onConflictDoNothing.
 * Si ya existe un pedido con la misma sucursal e idempotencyKey,
 * devuelve el pedido existente sin duplicar items ni mensajes.
 */
export async function insertOrderIdempotent(
  tx: typeof db,
  values: typeof orders.$inferInsert
): Promise<{ order: typeof orders.$inferSelect; isNew: boolean }> {
  const [inserted] = await tx
    .insert(orders)
    .values(values)
    .onConflictDoNothing({ target: [orders.branchId, orders.idempotencyKey] })
    .returning();

  if (inserted) {
    return { order: inserted, isNew: true };
  }

  const [existing] = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.branchId, values.branchId as number),
        eq(orders.idempotencyKey, values.idempotencyKey as string),
        isNull(orders.deletedAt)
      )
    )
    .limit(1);

  if (!existing) {
    throw new DomainError('No se pudo crear ni recuperar el pedido.');
  }

  return { order: existing, isNew: false };
}

export async function insertOrderItems(
  tx: typeof db,
  values: (typeof orderItems.$inferInsert)[]
): Promise<void> {
  await tx.insert(orderItems).values(values);
}

export async function insertItems(
  tx: typeof db,
  values: (typeof orderItems.$inferInsert)[]
): Promise<typeof orderItems.$inferSelect[]> {
  return tx.insert(orderItems).values(values).returning();
}

export async function insertItemRecipes(
  tx: typeof db,
  values: (typeof orderItemRecipes.$inferInsert)[]
): Promise<void> {
  if (values.length === 0) return;
  await tx.insert(orderItemRecipes).values(values);
}

export async function updateStatus(
  tx: typeof db,
  branchId: number,
  id: number,
  values: Partial<typeof orders.$inferInsert>
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'>> {
  const [updated] = await tx
    .update(orders)
    .set(values)
    .where(and(eq(orders.id, id), eq(orders.branchId, branchId)))
    .returning();

  if (!updated) {
    throw new DomainError('No se pudo actualizar el pedido.');
  }

  const safeOrder = stripIdempotencyHash(updated);
  return safeOrder;
}

export async function cancel(
  tx: typeof db,
  branchId: number,
  id: number,
  values: Partial<typeof orders.$inferInsert>
): Promise<Omit<typeof orders.$inferSelect, 'idempotencyHash'>> {
  const [updated] = await tx
    .update(orders)
    .set(values)
    .where(and(eq(orders.id, id), eq(orders.branchId, branchId)))
    .returning();

  if (!updated) {
    throw new DomainError('No se pudo cancelar el pedido.');
  }

  const safeOrder = stripIdempotencyHash(updated);
  return safeOrder;
}

export async function findByOrderNumberAndCustomer(
  branchId: number,
  orderNumber: string,
  customerName?: string,
  customerPhone?: string
): Promise<OrderWithItems | undefined> {
  const conditions: ReturnType<typeof and>[] = [
    eq(orders.branchId, branchId),
    eq(orders.orderNumber, orderNumber),
    isNull(orders.deletedAt),
  ];

  if (customerName?.trim()) {
    conditions.push(eq(orders.customerName, customerName.trim()));
  }

  if (customerPhone?.trim()) {
    conditions.push(eq(orders.customerPhone, customerPhone.trim().replace(/\s/g, '')));
  }

  const order = await db.query.orders.findFirst({
    where: and(...conditions),
    // Orden determinista: orderNumber es único por sucursal y la consulta
    // filtra por ella, así que ante duplicados se toma el más reciente.
    orderBy: (o, { desc }) => [desc(o.createdAt), desc(o.id)],
    with: { branch: true, items: { with: { product: true, recipeSnapshots: true } } },
  });

  return order ? normalizeOrder(order) : undefined;
}
