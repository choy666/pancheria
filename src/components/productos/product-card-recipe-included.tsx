import { formatRecipeItemName } from '@/lib/recipe-helpers';
import type { RecipeItemConfig } from '@/domain/types';

interface ProductCardRecipeIncludedProps {
  recipe: RecipeItemConfig[];
  showOptionalHint?: boolean;
}

export function ProductCardRecipeIncluded({
  recipe,
  showOptionalHint = false,
}: ProductCardRecipeIncludedProps) {
  if (recipe.length === 0) {
    return null;
  }

  const includedItems = recipe
    .filter((item) => !item.isOptional || item.selectedByDefault)
    .map((item) =>
      item.isOptional ? item.supplyName : formatRecipeItemName(item)
    );

  if (includedItems.length === 0) {
    return null;
  }

  const optionalItems = recipe.filter((item) => item.isOptional);

  return (
    <p className="text-sm text-muted-foreground">
      Incluye: {includedItems.join(', ')}
      {showOptionalHint && optionalItems.length > 0 && ' (se puede quitar)'}
    </p>
  );
}
