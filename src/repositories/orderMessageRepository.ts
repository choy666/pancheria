import { eq, and, isNull, isNotNull, asc, desc, sql, gt, lt, count, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orderMessages, orders } from '@/db/schema';
import { DomainError } from '@/domain/errors';
import { nowUTC } from '@/lib/date';
import type { OrderMessageSenderType } from '@/domain/types';

interface FindByOrderIdOptions {
  limit?: number;
  offset?: number;
  before?: number;
  after?: number;
}

export async function findByOrderId(
  orderId: number,
  options: FindByOrderIdOptions = {}
): Promise<(typeof orderMessages.$inferSelect)[]> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const conditions = [eq(orderMessages.orderId, orderId)];

  if (options.before !== undefined) {
    conditions.push(lt(orderMessages.id, options.before));
  }

  if (options.after !== undefined) {
    conditions.push(gt(orderMessages.id, options.after));
  }

  if (options.after !== undefined) {
    return db.query.orderMessages.findMany({
      where: and(...conditions),
      orderBy: asc(orderMessages.id),
      limit,
      offset,
    });
  }

  const rows = await db.query.orderMessages.findMany({
    where: and(...conditions),
    orderBy: desc(orderMessages.id),
    limit,
    offset,
  });

  return rows.reverse();
}

export async function countByOrderId(orderId: number): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(orderMessages)
    .where(eq(orderMessages.orderId, orderId));

  return Number(row?.count ?? 0);
}

export async function insertMessage(
  tx: typeof db,
  values: typeof orderMessages.$inferInsert
): Promise<typeof orderMessages.$inferSelect> {
  const [message] = await tx.insert(orderMessages).values(values).returning();

  if (!message) {
    throw new DomainError('No se pudo crear el mensaje.');
  }

  return message;
}

export async function markAllAsReadByOrderAndSender(
  orderId: number,
  senderType: OrderMessageSenderType
): Promise<number> {
  const result = await db
    .update(orderMessages)
    .set({ readAt: nowUTC() })
    .where(
      and(
        eq(orderMessages.orderId, orderId),
        eq(orderMessages.senderType, senderType),
        isNull(orderMessages.readAt)
      )
    )
    .returning({ id: orderMessages.id });

  return result.length;
}

export async function markAllAsDeliveredByOrderAndSender(
  orderId: number,
  senderType: OrderMessageSenderType
): Promise<number> {
  const result = await db
    .update(orderMessages)
    .set({ deliveredAt: nowUTC() })
    .where(
      and(
        eq(orderMessages.orderId, orderId),
        eq(orderMessages.senderType, senderType),
        isNull(orderMessages.deliveredAt)
      )
    )
    .returning({ id: orderMessages.id });

  return result.length;
}

export async function countUnreadByOrderAndSender(
  orderId: number,
  senderType: OrderMessageSenderType
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(orderMessages)
    .where(
      and(
        eq(orderMessages.orderId, orderId),
        eq(orderMessages.senderType, senderType),
        isNull(orderMessages.readAt)
      )
    );

  return Number(rows[0]?.count ?? 0);
}

/**
 * Devuelve ids y claves de adjunto de mensajes pertenecientes a pedidos en
 * estado terminal (`finished`/`cancelled`) creados antes de `cutoff`. Se
 * usa para la purga por retención; `attachmentKey` permite liberar el
 * archivo asociado después de borrar la fila.
 */
export async function findExpiredForTerminalOrders(
  cutoff: Date,
  limit: number
): Promise<{ id: number; attachmentKey: string | null }[]> {
  return db
    .select({
      id: orderMessages.id,
      attachmentKey: orderMessages.attachmentKey,
    })
    .from(orderMessages)
    .innerJoin(orders, eq(orderMessages.orderId, orders.id))
    .where(
      and(
        inArray(orders.status, ['finished', 'cancelled']),
        lt(orderMessages.createdAt, cutoff)
      )
    )
    .orderBy(asc(orderMessages.id))
    .limit(limit);
}

export async function deleteByIds(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;

  const result = await db
    .delete(orderMessages)
    .where(inArray(orderMessages.id, ids))
    .returning({ id: orderMessages.id });

  return result.length;
}

export async function findAllAttachmentKeys(
  options: { limit?: number; offset?: number } = {}
): Promise<string[]> {
  let query = db
    .select({ attachmentKey: orderMessages.attachmentKey })
    .from(orderMessages)
    .where(isNotNull(orderMessages.attachmentKey))
    .$dynamic();

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options.offset !== undefined) {
    query = query.offset(options.offset);
  }

  const rows = await query;

  return rows.map((row) => row.attachmentKey as string);
}
