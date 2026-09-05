import {
  eq,
  and,
  asc,
  desc,
  gte,
  lte,
  isNull,
  isNotNull,
  count,
  inArray,
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

export type CashRegisterRow = typeof cashRegisters.$inferSelect;

export async function findOpen(branchId: number) {
  return db.query.cashRegisters.findFirst({
    where: and(
      eq(cashRegisters.branchId, branchId),
      eq(cashRegisters.status, 'open'),
      isNull(cashRegisters.deletedAt)
    ),
    // Orden determinista: ante datos legacy con más de una caja abierta,
    // se elige la abierta más recientemente.
    orderBy: [desc(cashRegisters.openedAt), desc(cashRegisters.id)],
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

export async function create(
  params: {
    branchId: number;
    openedAt: Date;
    openedBy: string;
    initialAmount?: number;
  },
  dbOrTx?: typeof db
) {
  const client = dbOrTx ?? db;
  const [result] = await client
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
  data: Partial<typeof cashRegisters.$inferInsert>,
  dbOrTx?: typeof db
) {
  const client = dbOrTx ?? db;
  const [result] = await client
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

export async function lockCashRegisterById(
  tx: typeof db,
  branchId: number,
  id: number,
  options: { requireOpen?: boolean; requireNotDeleted?: boolean } = {}
): Promise<CashRegisterRow | null> {
  const conditions: ReturnType<typeof and>[] = [
    eq(cashRegisters.id, id),
    eq(cashRegisters.branchId, branchId),
  ];

  if (options.requireOpen) {
    conditions.push(eq(cashRegisters.status, 'open'));
  }

  if (options.requireNotDeleted) {
    conditions.push(isNull(cashRegisters.deletedAt));
  }

  const [locked] = await tx
    .select()
    .from(cashRegisters)
    .where(and(...conditions))
    .for('update');

  return locked ?? null;
}

export async function lockOpenCashRegister(
  tx: typeof db,
  branchId: number
): Promise<CashRegisterRow | null> {
  const [locked] = await tx
    .select()
    .from(cashRegisters)
    .where(
      and(
        eq(cashRegisters.branchId, branchId),
        eq(cashRegisters.status, 'open'),
        isNull(cashRegisters.deletedAt)
      )
    )
    .orderBy(asc(cashRegisters.id))
    .for('update');

  return locked ?? null;
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

    const ids = rows.map((row) => row.id);

    // Una sola consulta agregada para saber qué cajas tienen ventas asociadas,
    // en lugar de un count() por cada caja (patrón N+1).
    const salesCountRows = await tx
      .select({ cashRegisterId: sales.cashRegisterId, value: count() })
      .from(sales)
      .where(inArray(sales.cashRegisterId, ids))
      .groupBy(sales.cashRegisterId);

    const idsWithSales = new Set(
      salesCountRows
        .filter((row) => Number(row.value) > 0)
        .map((row) => row.cashRegisterId)
    );

    const deletableIds = ids.filter((id) => !idsWithSales.has(id));

    if (deletableIds.length === 0) {
      return { deleted: 0 };
    }

    await tx
      .delete(cashRegisters)
      .where(
        and(
          eq(cashRegisters.branchId, branchId),
          inArray(cashRegisters.id, deletableIds)
        )
      );

    return { deleted: deletableIds.length };
  });
}
