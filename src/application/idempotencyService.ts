import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sales, orders } from '@/db/schema';
import type { PaymentPart } from '@/domain/types';

type IdempotencyScope = 'sale' | 'order';

type SaleRow = typeof sales.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

type SaleWithPayments = SaleRow & { payments: PaymentPart[] };

export async function findExistingByIdempotencyKey(
  scope: 'sale',
  branchId: number,
  key: string,
  client?: typeof db
): Promise<SaleWithPayments | null>;
export async function findExistingByIdempotencyKey(
  scope: 'order',
  branchId: number,
  key: string,
  client?: typeof db
): Promise<OrderRow | null>;
export async function findExistingByIdempotencyKey(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client?: typeof db
): Promise<SaleWithPayments | OrderRow | null>;
export async function findExistingByIdempotencyKey(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client: typeof db = db
): Promise<SaleWithPayments | OrderRow | null> {
  if (scope === 'sale') {
    const existing = await client.query.sales.findFirst({
      where: and(
        eq(sales.branchId, branchId),
        eq(sales.idempotencyKey, key)
      ),
      with: {
        payments: true,
      },
    });
    return (existing as SaleWithPayments | undefined) ?? null;
  }

  const existing = await client.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key)
    ),
  });
  return (existing as OrderRow | undefined) ?? null;
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
