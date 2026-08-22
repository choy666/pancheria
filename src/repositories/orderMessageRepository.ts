import { eq, and, isNull, isNotNull, asc, desc, sql, gt, lt, count } from 'drizzle-orm';
import { db } from '@/db';
import { orderMessages } from '@/db/schema';
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
    throw new Error('No se pudo crear el mensaje.');
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

export async function findAllAttachmentKeys(): Promise<string[]> {
  const rows = await db
    .select({ attachmentKey: orderMessages.attachmentKey })
    .from(orderMessages)
    .where(isNotNull(orderMessages.attachmentKey));

  return rows.map((row) => row.attachmentKey as string);
}
