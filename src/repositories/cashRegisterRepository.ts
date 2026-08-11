import {
  eq,
  and,
  desc,
  gte,
  lte,
  isNull,
  isNotNull,
  inArray,
  count,
} from 'drizzle-orm';
import { db } from '@/db';
import { cashRegisters, sales } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import { executeInTransaction } from '@/application/transactionService';
import type {
  CashRegisterStatus,
  PaginatedResult,
  PaginationParams,
} from '@/domain/types';

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
  });
}

export async function findInRange(
  start: Date,
  end: Date,
  status?: CashRegisterStatus,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof cashRegisters.$inferSelect>> {
  const conditions = [
    gte(cashRegisters.openedAt, start),
    lte(cashRegisters.openedAt, end),
    isNull(cashRegisters.deletedAt),
  ];

  if (status) {
    conditions.push(eq(cashRegisters.status, status));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(cashRegisters)
    .where(and(...conditions));

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.cashRegisters.findMany({
    where: and(...conditions),
    orderBy: [desc(cashRegisters.openedAt)],
    limit,
    offset,
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: limit ?? total,
  };
}

export async function findClosedInRange(
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return findInRange(start, end, 'closed', pagination);
}

export async function findDeletedInRange(
  start: Date,
  end: Date,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof cashRegisters.$inferSelect>> {
  const conditions = [
    isNotNull(cashRegisters.deletedAt),
    gte(cashRegisters.deletedAt, start),
    lte(cashRegisters.deletedAt, end),
  ];

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(cashRegisters)
    .where(and(...conditions));

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.cashRegisters.findMany({
    where: and(...conditions),
    orderBy: [desc(cashRegisters.deletedAt)],
    limit,
    offset,
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: limit ?? total,
  };
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
    .set({ deletedAt: nowUTC() })
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
