import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sales, orders } from '@/db/schema';

type IdempotencyScope = 'sale' | 'order';

export async function isIdempotencyKeyUsed(
  scope: IdempotencyScope,
  branchId: number,
  key: string
): Promise<boolean> {
  if (scope === 'sale') {
    const existing = await db.query.sales.findFirst({
      where: and(eq(sales.branchId, branchId), eq(sales.idempotencyKey, key)),
    });
    return !!existing;
  }

  const existing = await db.query.orders.findFirst({
    where: and(eq(orders.branchId, branchId), eq(orders.idempotencyKey, key)),
  });
  return !!existing;
}
