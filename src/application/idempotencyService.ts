import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sales, orders } from '@/db/schema';

type IdempotencyScope = 'sale' | 'order';

type SaleRow = typeof sales.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

export async function findExistingByIdempotencyKey<
  T extends IdempotencyScope
>(
  scope: T,
  branchId: number,
  key: string,
  client: typeof db = db
): Promise<(T extends 'sale' ? SaleRow : OrderRow) | null> {
  if (scope === 'sale') {
    const existing = await client.query.sales.findFirst({
      where: and(
        eq(sales.branchId, branchId),
        eq(sales.idempotencyKey, key)
      ),
    });
    return (existing ?? null) as (T extends 'sale' ? SaleRow : OrderRow) | null;
  }

  const existing = await client.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key)
    ),
  });
  return (existing ?? null) as (T extends 'sale' ? SaleRow : OrderRow) | null;
}

export async function isIdempotencyKeyUsed(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client?: typeof db
): Promise<boolean> {
  const existing = await findExistingByIdempotencyKey(
    scope,
    branchId,
    key,
    client
  );
  return !!existing;
}
