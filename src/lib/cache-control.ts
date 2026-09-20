/**
 * Construye el header `Cache-Control` para respuestas públicas cacheables
 * en el CDN (Vercel honra `s-maxage` por URL completa, query string
 * incluida).
 *
 * `max-age=0` evita que el navegador cachee: cada poll del cliente llega al
 * CDN, que absorbe la carga entre visitantes durante la ventana
 * `s-maxage` + `stale-while-revalidate`.
 *
 * Devuelve `undefined` cuando la caché está deshabilitada
 * (`sMaxageSeconds <= 0`) para conservar el comportamiento sin header.
 */
export function buildCdnCacheControlHeaders(
  sMaxageSeconds: number,
  staleWhileRevalidateSeconds: number
): Record<string, string> | undefined {
  if (sMaxageSeconds <= 0) return undefined;

  return {
    'Cache-Control': `public, max-age=0, s-maxage=${sMaxageSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  };
}
