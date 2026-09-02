import type { RecipeItemConfig } from '@/domain/types';

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
