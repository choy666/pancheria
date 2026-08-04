import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { stockMovements } from '@/db/schema';
import type { StockMovementType } from '@/domain/types';

export async function findByProductId(productId: number, limit = 100) {
  return db.query.stockMovements.findMany({
    where: eq(stockMovements.productId, productId),
    orderBy: (stockMovements, { desc }) => [desc(stockMovements.createdAt)],
    limit,
  });
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
