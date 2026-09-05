export type CompoundAvailabilityRecipe = {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: { stock: number } | null;
};

/**
 * Calcula la cantidad de unidades de un producto compuesto que se pueden armar
 * a partir del stock de sus insumos críticos.
 *
 * Solo los insumos con `autoDiscount === true` limitan la disponibilidad.
 * Los insumos opcionales o manuales (`autoDiscount === false`) no afectan el
 * cálculo. Si la receta no tiene insumos críticos con `autoDiscount`, la
 * disponibilidad reportada es `0` porque no se conoce un insumo limitante.
 *
 * `stockBySupplyId` permite sobreescribir el stock de cada insumo, por ejemplo
 * cuando se evalúa disponibilidad considerando reservas o consumos acumulados.
 * `consumedBySupplyId` resta una cantidad previamente comprometida del stock
 * disponible.
 */
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
