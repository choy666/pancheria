/**
 * Convierte un valor de ID a un entero positivo.
 * Devuelve null si el valor no es un número entero positivo.
 */
export function parseId(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}
