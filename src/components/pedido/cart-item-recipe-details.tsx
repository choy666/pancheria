import { formatRecipeSummary } from '@/lib/recipe-helpers';
import type { RecipeItemConfig } from '@/domain/types';

interface CartItemRecipeDetailsProps {
  recipe?: RecipeItemConfig[] | null;
  selectedRecipeItemIds?: number[] | null;
}

export function CartItemRecipeDetails({
  recipe,
  selectedRecipeItemIds,
}: CartItemRecipeDetailsProps) {
  if (!recipe || recipe.length === 0) return null;

  const selectedIds = new Set(selectedRecipeItemIds ?? []);
  const recipeWithSelection = recipe.map((r) => ({
    ...r,
    selected: !r.isOptional || selectedIds.has(r.supplyId),
  }));

  const summary = formatRecipeSummary(recipeWithSelection);
  if (!summary) return null;

  return <span>{summary}</span>;
}
