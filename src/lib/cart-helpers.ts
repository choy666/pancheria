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
