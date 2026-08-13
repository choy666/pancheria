import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { recipes, products } from '@/db/schema';
import type { recipeItemSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type RecipeItemInsert = z.infer<typeof recipeItemSchema>;

async function assertProductInBranch(branchId: number, productId: number) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.branchId, branchId)),
    columns: { id: true },
  });
  return product !== null;
}

export async function findByCompoundProductId(
  branchId: number,
  compoundProductId: number
) {
  if (!(await assertProductInBranch(branchId, compoundProductId))) {
    return [];
  }

  return db.query.recipes.findMany({
    where: eq(recipes.compoundProductId, compoundProductId),
    with: {
      supply: true,
    },
  });
}

export async function deleteByCompoundProductId(
  branchId: number,
  compoundProductId: number
) {
  if (!(await assertProductInBranch(branchId, compoundProductId))) {
    return;
  }

  return db.delete(recipes).where(eq(recipes.compoundProductId, compoundProductId));
}

export async function deleteBySupplyId(branchId: number, supplyId: number) {
  if (!(await assertProductInBranch(branchId, supplyId))) {
    return;
  }

  return db.delete(recipes).where(eq(recipes.supplyId, supplyId));
}
