import { and, count, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import type { ProductRow } from '@/domain/types';

/**
 * Condición SQL de "vendible al público": compuestos, servicios y bebidas
 * críticas. Debe mantenerse alineada con `isPublicSellableProduct` de
 * `src/lib/catalog.ts`. Se aplica en la query para que `limit`/`offset`
 * paginen solo sobre productos públicos.
 */
function publicSellableConditions(branchId: number) {
  return and(
    eq(products.branchId, branchId),
    eq(products.isActive, true),
    isNull(products.deletedAt),
    or(
      eq(products.type, 'compound'),
      eq(products.type, 'service'),
      and(
        eq(products.type, 'critical_supply'),
        eq(products.criticalSupplyType, 'beverage')
      )
    )
  );
}

export async function findPublicProducts(
  branchId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<ProductRow[]> {
  return db.query.products.findMany({
    where: publicSellableConditions(branchId),
    orderBy: (products, { asc }) => [asc(products.name)],
    limit: options.limit,
    offset: options.offset,
  });
}

export async function countPublicProducts(branchId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .where(publicSellableConditions(branchId));

  return Number(row?.total ?? 0);
}
