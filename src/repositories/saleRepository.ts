import { eq, and, gte, lt, count } from 'drizzle-orm';
import { db } from '@/db';
import {
  sales,
  saleItems,
  saleItemRecipes,
  salePayments,
  products,
  cashRegisters,
} from '@/db/schema';
import { DomainError } from '@/domain/errors';
import { nowUTC } from '@/lib/date';
import type { PaginatedResult, PaginationParams, PaymentPart, SaleStatus } from '@/domain/types';

export type SaleRow = typeof sales.$inferSelect;

export type SaleWithDetails = SaleRow & {
  items: (typeof saleItems.$inferSelect & {
    product: typeof products.$inferSelect | null;
    recipeSnapshots: (typeof saleItemRecipes.$inferSelect)[];
  })[];
  payments: (typeof salePayments.$inferSelect)[];
  cashRegister: (typeof cashRegisters.$inferSelect) | null;
};

export type SaleItemRecipeInsert = typeof saleItemRecipes.$inferInsert;

export async function findById(branchId: number, id: number) {
  const result = await db.query.sales.findFirst({
    where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
    with: {
      items: {
        with: {
          product: true,
          recipeSnapshots: true,
        },
      },
      payments: true,
    },
  });
  return result ?? null;
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
          recipeSnapshots: true,
        },
      },
      payments: true,
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
          recipeSnapshots: true,
        },
      },
      payments: true,
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
  payments: PaymentPart[];
  cashRegisterId?: number | null;
  idempotencyKey: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}) {
  const { branchId, total, payments, cashRegisterId, idempotencyKey, items } = params;

  const primaryPaymentMethod = payments[0]?.method ?? 'cash';

  const [sale] = await db
    .insert(sales)
    .values({
      branchId,
      total,
      paymentMethod: primaryPaymentMethod,
      cashRegisterId,
      idempotencyKey,
    })
    .returning();

  if (!sale) throw new DomainError('No se pudo crear la venta.');

  await db.insert(saleItems).values(
    items.map((item) => ({
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }))
  );

  if (payments.length > 0) {
    await db.insert(salePayments).values(
      payments.map((payment) => ({
        saleId: sale.id,
        method: payment.method,
        amount: payment.amount,
      }))
    );
  }

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

export async function insertSale(
  tx: typeof db,
  values: typeof sales.$inferInsert
): Promise<typeof sales.$inferSelect | undefined> {
  const [sale] = await tx
    .insert(sales)
    .values(values)
    .onConflictDoNothing()
    .returning();
  return sale;
}

export async function insertItems(
  tx: typeof db,
  rows: (typeof saleItems.$inferInsert)[]
): Promise<typeof saleItems.$inferSelect[]> {
  return tx.insert(saleItems).values(rows).returning();
}

export async function insertItemRecipes(
  tx: typeof db,
  rows: (typeof saleItemRecipes.$inferInsert)[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(saleItemRecipes).values(rows);
}

export async function insertPayments(
  tx: typeof db,
  rows: (typeof salePayments.$inferInsert)[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(salePayments).values(rows);
}

export async function findByIdWithDetails(
  tx: typeof db,
  branchId: number,
  id: number
): Promise<SaleWithDetails | undefined> {
  return tx.query.sales.findFirst({
    where: and(eq(sales.id, id), eq(sales.branchId, branchId)),
    with: {
      items: { with: { product: true, recipeSnapshots: true } },
      payments: true,
      cashRegister: true,
    },
  }) as unknown as Promise<SaleWithDetails | undefined>;
}

export async function cancelIfActive(
  tx: typeof db,
  branchId: number,
  id: number,
  values: Partial<typeof sales.$inferInsert>
): Promise<typeof sales.$inferSelect | undefined> {
  const [updated] = await tx
    .update(sales)
    .set(values)
    .where(
      and(
        eq(sales.id, id),
        eq(sales.branchId, branchId),
        eq(sales.status, 'active')
      )
    )
    .returning();

  return updated;
}
