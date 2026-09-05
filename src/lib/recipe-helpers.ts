import { inArray } from 'drizzle-orm';
import { recipes } from '@/db/schema';
import type { ProductRow, RecipeItemConfig } from '@/domain/types';
import type { CompoundAvailabilityRecipe } from '@/lib/availability-helpers';

export type RecipeWithSupply = typeof recipes.$inferSelect & {
  supply: ProductRow | null;
} & CompoundAvailabilityRecipe;

export async function findRecipesForProducts(
  branchId: number,
  compoundProductIds: number[],
  dbOrTx: typeof import('@/db').db
): Promise<RecipeWithSupply[]> {
  if (compoundProductIds.length === 0) return [];

  const allRecipes = (await dbOrTx.query.recipes.findMany({
    where: inArray(recipes.compoundProductId, compoundProductIds),
    with: { supply: true },
  })) as RecipeWithSupply[];

  return allRecipes.filter((recipe) => recipe.supply?.branchId === branchId);
}

export function groupRecipesByProduct(allRecipes: RecipeWithSupply[]) {
  const recipesByProduct = new Map<number, RecipeWithSupply[]>();

  for (const recipeItem of allRecipes) {
    if (!recipesByProduct.has(recipeItem.compoundProductId)) {
      recipesByProduct.set(recipeItem.compoundProductId, []);
    }
    recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
  }

  return recipesByProduct;
}

export function formatRecipeItemName(item: RecipeItemConfig): string {
  return item.isOptional
    ? item.supplyName
    : `${item.supplyName} (${item.quantity})`;
}

export function formatRecipeSummary(recipe: RecipeItemConfig[]): string {
  const selected = recipe.filter((r) => !r.isOptional || r.selected);
  const removed = recipe.filter((r) => r.isOptional && !r.selected);

  const parts: string[] = [];
  if (selected.length > 0) {
    parts.push(`Incluye: ${selected.map(formatRecipeItemName).join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`Sin: ${removed.map(formatRecipeItemName).join(', ')}`);
  }

  return parts.join('. ');
}
