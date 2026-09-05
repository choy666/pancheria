import { eq, and, count } from 'drizzle-orm';
import { db } from '@/db';
import { stockMovements } from '@/db/schema';
import type { PaginatedResult, PaginationParams, StockMovementType } from '@/domain/types';

export async function findByProductId(
  branchId: number,
  productId: number,
  pagination: PaginationParams
): Promise<PaginatedResult<typeof stockMovements.$inferSelect>> {
  const conditions = and(
    eq(stockMovements.productId, productId),
    eq(stockMovements.branchId, branchId)
  );

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(stockMovements)
    .where(conditions);

  const items = await db.query.stockMovements.findMany({
    where: conditions,
    orderBy: (stockMovements, { desc }) => [desc(stockMovements.createdAt)],
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return { items, total: Number(total), page: pagination.page, limit: pagination.limit };
}

export async function create(params: {
  branchId: number;
  productId: number;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  saleId?: number;
  orderId?: number;
}) {
  const [result] = await db
    .insert(stockMovements)
    .values({
      branchId: params.branchId,
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      reason: params.reason ?? null,
      saleId: params.saleId ?? null,
      orderId: params.orderId ?? null,
    })
    .returning();
  return result;
}
