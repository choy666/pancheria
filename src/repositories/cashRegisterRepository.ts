import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { cashRegisters } from '@/db/schema';

export async function findOpen() {
  return db.query.cashRegisters.findFirst({
    where: eq(cashRegisters.status, 'open'),
  });
}

export async function findById(id: number) {
  return db.query.cashRegisters.findFirst({
    where: eq(cashRegisters.id, id),
    with: {
      sales: {
        with: {
          items: {
            with: {
              product: true,
            },
          },
        },
      },
    },
  });
}

export async function findClosedInRange(start: Date, end: Date) {
  return db.query.cashRegisters.findMany({
    where: and(
      eq(cashRegisters.status, 'closed'),
      gte(cashRegisters.openedAt, start),
      lte(cashRegisters.openedAt, end)
    ),
    orderBy: [desc(cashRegisters.openedAt)],
  });
}

export async function create(data: {
  openedAt: Date;
  openedBy: string;
}) {
  const [result] = await db
    .insert(cashRegisters)
    .values({
      openedAt: data.openedAt,
      openedBy: data.openedBy,
      status: 'open',
    })
    .returning();
  return result;
}

export async function update(
  id: number,
  data: Partial<typeof cashRegisters.$inferInsert>
) {
  const [result] = await db
    .update(cashRegisters)
    .set(data)
    .where(eq(cashRegisters.id, id))
    .returning();
  return result ?? null;
}
