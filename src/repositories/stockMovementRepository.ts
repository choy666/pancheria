import { eq, count } from 'drizzle-orm';
import { db } from '@/db';
import { stockMovements } from '@/db/schema';
import type { PaginatedResult, PaginationParams, StockMovementType } from '@/domain/types';

export async function findByProductId(
  productId: number,
  pagination: PaginationParams
): Promise<PaginatedResult<typeof stockMovements.$inferSelect>> {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId));

  const items = await db.query.stockMovements.findMany({
    where: eq(stockMovements.productId, productId),
    orderBy: (stockMovements, { desc }) => [desc(stockMovements.createdAt)],
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return { items, total: Number(total), page: pagination.page, limit: pagination.limit };
}

export async function create(params: {
  productId: number;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  saleId?: number;
}) {
  const [result] = await db
    .insert(stockMovements)
    .values({
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      reason: params.reason ?? null,
      saleId: params.saleId ?? null,
    })
    .returning();
  return result;
}
