import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sales } from '@/db/schema';

export async function isIdempotencyKeyUsed(
  branchId: number,
  key: string
): Promise<boolean> {
  const existing = await db.query.sales.findFirst({
    where: and(eq(sales.branchId, branchId), eq(sales.idempotencyKey, key)),
  });
  return !!existing;
}
