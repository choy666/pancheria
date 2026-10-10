import {
  formatRecipeSummary,
  formatSelectedRecipeSummary,
} from '@/lib/recipe-helpers';
import type { RecipeItemConfig } from '@/domain/types';

interface CartItemRecipeDetailsProps {
  recipe?: RecipeItemConfig[] | null;
  selectedRecipeItemIds?: number[] | null;
  /**
   * `true` en las vistas del cliente: lista solo los insumos elegidos, sin
   * la sección "Sin" de los opcionales no seleccionados. En el terminal de
   * ventas (`/ventas`) se deja `false` para conservar el detalle operativo.
   */
  onlySelected?: boolean;
}

export function CartItemRecipeDetails({
  recipe,
  selectedRecipeItemIds,
  onlySelected = false,
}: CartItemRecipeDetailsProps) {
  if (!recipe || recipe.length === 0) return null;

  const selectedIds = new Set(selectedRecipeItemIds ?? []);
  const recipeWithSelection = recipe.map((r) => ({
    ...r,
    selected: !r.isOptional || selectedIds.has(r.supplyId),
  }));

  const summary = onlySelected
    ? formatSelectedRecipeSummary(recipeWithSelection)
    : formatRecipeSummary(recipeWithSelection);
  if (!summary) return null;

  return <span>{summary}</span>;
}
