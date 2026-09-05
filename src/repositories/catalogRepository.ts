import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { isPublicSellableProduct } from '@/lib/catalog';
import type { ProductRow } from '@/domain/types';

export async function findPublicProducts(
  branchId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<ProductRow[]> {
  const rows = await db.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit: options.limit,
    offset: options.offset,
  });

  return rows.filter(isPublicSellableProduct);
}
