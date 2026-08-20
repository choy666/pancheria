import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderMessages } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { OrderMessageSenderType } from '@/domain/types';

export async function findByOrderId(
  orderId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<(typeof orderMessages.$inferSelect)[]> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  return db.query.orderMessages.findMany({
    where: eq(orderMessages.orderId, orderId),
    orderBy: asc(orderMessages.createdAt),
    limit,
    offset,
  });
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
