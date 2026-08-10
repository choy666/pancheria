import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import type { recipeItemSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type RecipeItemInsert = z.infer<typeof recipeItemSchema>;

export async function findByCompoundProductId(compoundProductId: number) {
  return db.query.recipes.findMany({
    where: eq(recipes.compoundProductId, compoundProductId),
    with: {
      supply: true,
    },
  });
}

export async function replaceRecipe(
  compoundProductId: number,
  items: RecipeItemInsert[]
) {
  await db.delete(recipes).where(eq(recipes.compoundProductId, compoundProductId));

  if (items.length === 0) return [];

  const values = items.map((item) => ({
    compoundProductId,
    supplyId: item.supplyId,
    quantity: item.quantity,
    autoDiscount: item.autoDiscount,
  }));

  return db.insert(recipes).values(values).returning();
}

export async function deleteByCompoundProductId(compoundProductId: number) {
  return db.delete(recipes).where(eq(recipes.compoundProductId, compoundProductId));
}

export async function deleteBySupplyId(supplyId: number) {
  return db.delete(recipes).where(eq(recipes.supplyId, supplyId));
}
