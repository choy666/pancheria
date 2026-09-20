/**
 * Configuración de la capa de caché de servidor (Data Cache de Next.js,
 * `unstable_cache`). Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

const DEFAULT_DATA_CACHE_REVALIDATE_S = 60;

/**
 * Segundos de revalidación temporal de la caché de datos de servidor
 * (`DATA_CACHE_REVALIDATE_S`, por defecto 60). Actúa como red de seguridad
 * además de la invalidación por tag (`revalidateTag`) en los puntos de
 * mutación. `0` o negativo deshabilita la capa entera: cada lectura pega
 * directo a la base (kill switch sin deploy). Es una variable solo de
 * servidor: no lleva prefijo NEXT_PUBLIC_*.
 */
export function getDataCacheRevalidateSeconds(): number {
  const raw = process.env.DATA_CACHE_REVALIDATE_S;
  if (!raw) return DEFAULT_DATA_CACHE_REVALIDATE_S;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_DATA_CACHE_REVALIDATE_S;

  return Math.floor(parsed);
}
