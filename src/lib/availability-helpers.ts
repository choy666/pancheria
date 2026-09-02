export type CompoundAvailabilityRecipe = {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: { stock: number } | null;
};

export function calculateCompoundAvailability(
  recipeItems: CompoundAvailabilityRecipe[],
  stockBySupplyId?: Record<number, number>,
  consumedBySupplyId?: Record<number, number>
): number {
  const criticalItems = recipeItems.filter((r) => r.autoDiscount);
  if (criticalItems.length === 0) return 0;

  return Math.min(
    ...criticalItems.map((r) => {
      const stock = stockBySupplyId?.[r.supplyId] ?? r.supply?.stock ?? 0;
      const consumed = consumedBySupplyId?.[r.supplyId] ?? 0;
      return Math.floor((stock - consumed) / r.quantity);
    })
  );
}
