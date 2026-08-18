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
  product: SummaryProduct,
  quantity: number,
  recipesByProduct: Map<number, RecipeLike[]>,
  sign: 1 | -1 = 1
): void {
  productsSummary[product.name] =
    (productsSummary[product.name] ?? 0) + sign * quantity;

  if (product.type === 'compound') {
    const recipeList = recipesByProduct.get(product.id) ?? [];
    for (const recipeItem of recipeList) {
      if (!recipeItem.autoDiscount) continue;

      const consumed = recipeItem.quantity * quantity;
      const supplyName = recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
      criticalSuppliesSummary[supplyName] =
        (criticalSuppliesSummary[supplyName] ?? 0) + sign * consumed;
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
