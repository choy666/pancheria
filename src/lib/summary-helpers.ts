import type { RecipeItemConfig } from '@/domain/types';

type SummaryProduct = {
  id: number;
  name: string;
  type: string;
  criticalSupplyType: string | null;
};

type RecipeLike = {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: { name: string } | null;
};

export function addItemToSummary(
  productsSummary: Record<string, number>,
  criticalSuppliesSummary: Record<string, number>,
  recipeSuppliesSummary: Record<string, number>,
  product: SummaryProduct,
  quantity: number,
  recipesByProduct: Map<number, RecipeLike[]>,
  recipeSnapshot?: RecipeItemConfig[],
  sign: 1 | -1 = 1
): void {
  productsSummary[product.name] =
    (productsSummary[product.name] ?? 0) + sign * quantity;

  const effectiveSnapshot = recipeSnapshot ?? [];
  const hasSnapshot = effectiveSnapshot.length > 0;

  if (product.type === 'compound') {
    if (hasSnapshot) {
      for (const config of effectiveSnapshot) {
        if (!config.selected) continue;

        const consumed = config.quantity * quantity;
        recipeSuppliesSummary[config.supplyName] =
          (recipeSuppliesSummary[config.supplyName] ?? 0) + sign * consumed;

        if (config.autoDiscount) {
          criticalSuppliesSummary[config.supplyName] =
            (criticalSuppliesSummary[config.supplyName] ?? 0) + sign * consumed;
        }
      }
    } else {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        const consumed = recipeItem.quantity * quantity;
        const supplyName =
          recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;

        recipeSuppliesSummary[supplyName] =
          (recipeSuppliesSummary[supplyName] ?? 0) + sign * consumed;

        if (recipeItem.autoDiscount) {
          criticalSuppliesSummary[supplyName] =
            (criticalSuppliesSummary[supplyName] ?? 0) + sign * consumed;
        }
      }
    }
  } else if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    criticalSuppliesSummary[product.name] =
      (criticalSuppliesSummary[product.name] ?? 0) + sign * quantity;
  }
}

export function fillMissingCriticalSupplies(
  criticalSuppliesSummary: Record<string, number>,
  criticalSupplies: { name: string }[]
): void {
  for (const supply of criticalSupplies) {
    if (criticalSuppliesSummary[supply.name] === undefined) {
      criticalSuppliesSummary[supply.name] = 0;
    }
  }
}

/**
 * Consolida el consumo total por insumo: lo descontado vía recetas más las
 * ventas directas de productos no compuestos (servicios, bebidas críticas,
 * etc.). Los compuestos se excluyen porque su consumo ya figura desagregado
 * en `recipeSuppliesSummary`. Los nombres sin tipo conocido (p. ej. un
 * producto renombrado después de la venta) se cuentan como insumo para no
 * perder consumo en la vista.
 */
export function buildSuppliesSummary(
  productsSummary: Record<string, number>,
  recipeSuppliesSummary: Record<string, number>,
  productTypesByName: ReadonlyMap<string, string>
): Record<string, number> {
  const supplies: Record<string, number> = { ...recipeSuppliesSummary };
  for (const [name, quantity] of Object.entries(productsSummary)) {
    if (productTypesByName.get(name) === 'compound') continue;
    supplies[name] = (supplies[name] ?? 0) + quantity;
  }
  return supplies;
}
