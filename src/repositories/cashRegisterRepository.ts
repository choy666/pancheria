import {
  eq,
  and,
  desc,
  gte,
  lte,
  isNull,
  isNotNull,
  inArray,
} from 'drizzle-orm';
import { db } from '@/db';
import { cashRegisters, sales } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import type { CashRegisterStatus } from '@/domain/types';

export async function findOpen() {
  return db.query.cashRegisters.findFirst({
    where: and(
      eq(cashRegisters.status, 'open'),
      isNull(cashRegisters.deletedAt)
    ),
  });
}

export async function findById(id: number, includeDeleted = false) {
  return db.query.cashRegisters.findFirst({
    where: and(
      eq(cashRegisters.id, id),
      includeDeleted ? undefined : isNull(cashRegisters.deletedAt)
    ),
    with: {
      sales: {
        orderBy: (sales, { desc }) => [desc(sales.createdAt)],
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

export async function findInRange(
  start: Date,
  end: Date,
  status?: CashRegisterStatus
) {
  const conditions = [
    gte(cashRegisters.openedAt, start),
    lte(cashRegisters.openedAt, end),
    isNull(cashRegisters.deletedAt),
  ];

  if (status) {
    conditions.push(eq(cashRegisters.status, status));
  }

  return db.query.cashRegisters.findMany({
    where: and(...conditions),
    orderBy: [desc(cashRegisters.openedAt)],
  });
}

export async function findClosedInRange(start: Date, end: Date) {
  return findInRange(start, end, 'closed');
}

export async function findDeletedInRange(start: Date, end: Date) {
  return db.query.cashRegisters.findMany({
    where: and(
      isNotNull(cashRegisters.deletedAt),
      gte(cashRegisters.deletedAt, start),
      lte(cashRegisters.deletedAt, end)
    ),
    orderBy: [desc(cashRegisters.deletedAt)],
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

export async function softDelete(id: number) {
  const [result] = await db
    .update(cashRegisters)
    .set({ deletedAt: new Date() })
    .where(eq(cashRegisters.id, id))
    .returning();
  return result ?? null;
}

export async function restore(id: number) {
  const [result] = await db
    .update(cashRegisters)
    .set({ deletedAt: null })
    .where(eq(cashRegisters.id, id))
    .returning();
  return result ?? null;
}

export async function hardDelete(id: number) {
  return executeInTransaction(async (tx) => {
    const [row] = await tx
      .select({ deletedAt: cashRegisters.deletedAt })
      .from(cashRegisters)
      .where(eq(cashRegisters.id, id));

    if (!row || row.deletedAt === null) {
      return { deleted: false };
    }

    await tx
      .update(sales)
      .set({ cashRegisterId: null })
      .where(eq(sales.cashRegisterId, id));

    await tx.delete(cashRegisters).where(eq(cashRegisters.id, id));

    return { deleted: true };
  });
}

export async function hardDeleteAllDeletedInRange(start: Date, end: Date) {
  return executeInTransaction(async (tx) => {
    const rows = await tx
      .select({ id: cashRegisters.id })
      .from(cashRegisters)
      .where(
        and(
          isNotNull(cashRegisters.deletedAt),
          gte(cashRegisters.deletedAt, start),
          lte(cashRegisters.deletedAt, end)
        )
      );

    if (rows.length === 0) {
      return { deleted: 0 };
    }

    const ids = rows.map((row) => row.id);

    await tx
      .update(sales)
      .set({ cashRegisterId: null })
      .where(inArray(sales.cashRegisterId, ids));

    await tx.delete(cashRegisters).where(inArray(cashRegisters.id, ids));

    return { deleted: ids.length };
  });
}
