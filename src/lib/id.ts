import { ValidationError } from '@/domain/errors';

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

export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ValidationError('El parámetro de la ruta no es válido.');
  }
}
