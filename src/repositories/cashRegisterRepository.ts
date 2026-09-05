import {
  eq,
  and,
  desc,
  gte,
  lte,
  isNull,
  isNotNull,
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

export async function findOpen(branchId: number) {
  return db.query.cashRegisters.findFirst({
    where: and(
      eq(cashRegisters.branchId, branchId),
      eq(cashRegisters.status, 'open'),
      isNull(cashRegisters.deletedAt)
    ),
  });
}

export async function findById(
  branchId: number,
  id: number,
  includeDeleted = false
) {
  const conditions = [
    eq(cashRegisters.id, id),
    eq(cashRegisters.branchId, branchId),
  ];
  if (!includeDeleted) {
    conditions.push(isNull(cashRegisters.deletedAt));
  }

  const result = await db.query.cashRegisters.findFirst({
    where: and(...conditions),
  });
  return result ?? null;
}

export async function findInRange(
  branchId: number,
  start: Date,
  end: Date,
  status?: CashRegisterStatus,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof cashRegisters.$inferSelect>> {
  const conditions = [
    eq(cashRegisters.branchId, branchId),
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
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return findInRange(branchId, start, end, 'closed', pagination);
}

export async function findDeletedInRange(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof cashRegisters.$inferSelect>> {
  const conditions = [
    eq(cashRegisters.branchId, branchId),
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

export async function create(params: {
  branchId: number;
  openedAt: Date;
  openedBy: string;
  initialAmount?: number;
}) {
  const [result] = await db
    .insert(cashRegisters)
    .values({
      branchId: params.branchId,
      openedAt: params.openedAt,
      openedBy: params.openedBy,
      initialAmount: params.initialAmount ?? 0,
      status: 'open',
    })
    .returning();
  return result;
}

export async function update(
  branchId: number,
  id: number,
  data: Partial<typeof cashRegisters.$inferInsert>
) {
  const [result] = await db
    .update(cashRegisters)
    .set(data)
    .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function softDelete(branchId: number, id: number) {
  const [result] = await db
    .update(cashRegisters)
    .set({ deletedAt: nowUTC() })
    .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function restore(branchId: number, id: number) {
  const [result] = await db
    .update(cashRegisters)
    .set({ deletedAt: null })
    .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function hardDelete(branchId: number, id: number) {
  return executeInTransaction(async (tx) => {
    const [row] = await tx
      .select({ deletedAt: cashRegisters.deletedAt })
      .from(cashRegisters)
      .where(
        and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId))
      );

    if (!row || row.deletedAt === null) {
      return { deleted: false };
    }

    const [salesCount] = await tx
      .select({ value: count() })
      .from(sales)
      .where(eq(sales.cashRegisterId, id));

    if (Number(salesCount?.value ?? 0) > 0) {
      return { deleted: false, hasSales: true };
    }

    await tx
      .delete(cashRegisters)
      .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)));

    return { deleted: true };
  });
}

export async function hardDeleteAllDeletedInRange(
  branchId: number,
  start: Date,
  end: Date
) {
  return executeInTransaction(async (tx) => {
    const rows = await tx
      .select({ id: cashRegisters.id })
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.branchId, branchId),
          isNotNull(cashRegisters.deletedAt),
          gte(cashRegisters.deletedAt, start),
          lte(cashRegisters.deletedAt, end)
        )
      );

    if (rows.length === 0) {
      return { deleted: 0 };
    }

    let deleted = 0;

    for (const row of rows) {
      const [salesCount] = await tx
        .select({ value: count() })
        .from(sales)
        .where(eq(sales.cashRegisterId, row.id));

      if (Number(salesCount?.value ?? 0) > 0) {
        continue;
      }

      await tx
        .delete(cashRegisters)
        .where(and(eq(cashRegisters.id, row.id), eq(cashRegisters.branchId, branchId)));

      deleted++;
    }

    return { deleted };
  });
}
