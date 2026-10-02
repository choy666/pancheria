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

/** Máximo de caracteres de la aclaración libre por ítem (UI y validación). */
export const ITEM_NOTE_MAX_LENGTH = 200;

/**
 * Normaliza una aclaración de ítem a su forma canónica: recorta espacios en
 * los extremos y convierte ausencia, `null` o cadena vacía en `null`. Es la
 * forma que se usa para comparar identidad de líneas, firmas de idempotencia
 * y persistencia.
 */
export function normalizeItemNote(notes?: string | null): string | null {
  return notes?.trim() || null;
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

interface RecipeItemDefaultSelection {
  isOptional: boolean;
  selectedByDefault: boolean;
  supplyId: number;
}

/**
 * Devuelve los `supplyId` de los insumos opcionales de una receta que estén
 * marcados como seleccionados por defecto.
 */
export function getDefaultSelectedRecipeItemIds(product: {
  recipe?: RecipeItemDefaultSelection[];
}): number[] {
  return (
    product.recipe
      ?.filter((item) => item.isOptional && item.selectedByDefault)
      .map((item) => item.supplyId) ?? []
  );
}

export interface CartSubmitLine {
  productId: number;
  quantity: number;
  selectedRecipeItemIds?: number[];
  notes?: string | null;
}

/**
 * Agrupa líneas idénticas del carrito (mismo producto, mismas selecciones y
 * misma aclaración) sumando sus cantidades. La UI puede mostrar cada unidad
 * en su propia línea mientras el payload al confirmar un pedido o una venta
 * queda compacto.
 */
export function groupCartItemsForSubmit(
  lines: CartSubmitLine[]
): {
  productId: number;
  quantity: number;
  selectedRecipeItemIds: number[];
  notes: string | null;
}[] {
  const groups = new Map<
    string,
    {
      productId: number;
      quantity: number;
      selectedRecipeItemIds: number[];
      notes: string | null;
    }
  >();

  for (const line of lines) {
    const selected = line.selectedRecipeItemIds ?? [];
    const notes = normalizeItemNote(line.notes);
    const key = `${line.productId}:${[...selected].sort((a, b) => a - b).join(',')}:${JSON.stringify(notes)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      groups.set(key, {
        productId: line.productId,
        quantity: line.quantity,
        selectedRecipeItemIds: [...selected],
        notes,
      });
    }
  }

  return Array.from(groups.values());
}
