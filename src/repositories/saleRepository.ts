import { eq, and, gte, lt, count } from 'drizzle-orm';
import { db } from '@/db';
import { sales, saleItems } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { PaginatedResult, PaginationParams, PaymentMethod, SaleStatus } from '@/domain/types';

export async function findById(branchId: number, id: number) {
  return db.query.sales.findFirst({
    where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });
}

export async function findByDateRange(
  branchId: number,
  start: Date,
  end: Date,
  status?: SaleStatus,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof sales.$inferSelect>> {
  const conditions = [
    eq(sales.branchId, branchId),
    gte(sales.createdAt, start),
    lt(sales.createdAt, end),
  ];

  if (status) {
    conditions.push(eq(sales.status, status));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(sales)
    .where(and(...conditions));

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.sales.findMany({
    where: and(...conditions),
    orderBy: (sales, { desc }) => [desc(sales.createdAt)],
    limit,
    offset,
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: limit ?? total,
  };
}

export async function findByCashRegisterId(
  branchId: number,
  cashRegisterId: number,
  status?: SaleStatus,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof sales.$inferSelect>> {
  const conditions = [
    eq(sales.branchId, branchId),
    eq(sales.cashRegisterId, cashRegisterId),
  ];

  if (status) {
    conditions.push(eq(sales.status, status));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(sales)
    .where(and(...conditions));

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.sales.findMany({
    where: and(...conditions),
    orderBy: (sales, { desc }) => [desc(sales.createdAt)],
    limit,
    offset,
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
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
  total: number;
  paymentMethod: PaymentMethod;
  cashRegisterId?: number | null;
  idempotencyKey: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}) {
  const { branchId, total, paymentMethod, cashRegisterId, idempotencyKey, items } = params;

  const [sale] = await db
    .insert(sales)
    .values({
      branchId,
      total,
      paymentMethod,
      cashRegisterId,
      idempotencyKey,
    })
    .returning();

  if (!sale) throw new Error('No se pudo crear la venta.');

  await db.insert(saleItems).values(
    items.map((item) => ({
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }))
  );

  return sale;
}

export async function cancel(branchId: number, id: number, reason: string) {
  const [result] = await db
    .update(sales)
    .set({
      status: 'cancelled',
      cancelledAt: nowUTC(),
      cancellationReason: reason,
    })
    .where(and(eq(sales.id, id), eq(sales.branchId, branchId)))
    .returning();
  return result ?? null;
}
