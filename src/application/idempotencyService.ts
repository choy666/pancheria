import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sales } from '@/db/schema';

export async function isIdempotencyKeyUsed(key: string): Promise<boolean> {
  const existing = await db.query.sales.findFirst({
    where: eq(sales.idempotencyKey, key),
  });
  return !!existing;
}
