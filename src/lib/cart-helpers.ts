/**
 * Compara dos selecciones de receta para determinar si son idénticas,
 * independientemente del orden en que se hayan seleccionado los insumos.
 */
export function areRecipeSelectionsEqual(
  a: number[],
  b: number[]
): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((id, i) => id === sortedB[i]);
}

interface RecipeWithOptionalFlag {
  isOptional: boolean;
}

/**
 * Indica si el producto admite personalización (tiene al menos un insumo
 * opcional en su receta). Los productos personalizables no se agrupan en el
 * carrito: cada unidad ocupa su propia línea para editarla por separado.
 */
export function hasOptionalRecipeItems(product: {
  recipe?: RecipeWithOptionalFlag[];
}): boolean {
  return product.recipe?.some((item) => item.isOptional) ?? false;
}

export interface CartSubmitLine {
  productId: number;
  quantity: number;
  selectedRecipeItemIds?: number[];
}

/**
 * Agrupa líneas idénticas del carrito (mismo producto y mismas selecciones)
 * sumando sus cantidades. La UI puede mostrar cada unidad en su propia línea
 * mientras el payload al confirmar un pedido o una venta queda compacto.
 */
export function groupCartItemsForSubmit(
  lines: CartSubmitLine[]
): { productId: number; quantity: number; selectedRecipeItemIds: number[] }[] {
  const groups = new Map<
    string,
    { productId: number; quantity: number; selectedRecipeItemIds: number[] }
  >();

  for (const line of lines) {
    const selected = line.selectedRecipeItemIds ?? [];
    const key = `${line.productId}:${[...selected].sort((a, b) => a - b).join(',')}`;
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      groups.set(key, {
        productId: line.productId,
        quantity: line.quantity,
        selectedRecipeItemIds: [...selected],
      });
    }
  }

  return Array.from(groups.values());
}
