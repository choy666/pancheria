/**
 * Configuración pública del catálogo. Estos valores se leen de variables de
 * entorno con prefijo NEXT_PUBLIC_* para que estén disponibles en el cliente.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getPedidoRefetchIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS;
  if (!raw) return 30_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 30_000;

  return parsed;
}

/**
 * Tamaño de página del catálogo público (`/pedido`). La página inicial se
 * carga por SSR y el resto se pide con "Cargar más". El default es
 * deliberadamente alto porque el catálogo de este negocio es acotado; la
 * paginación queda como capacidad para catálogos grandes.
 */
export function getCatalogPageSize(): number {
  const raw = process.env.NEXT_PUBLIC_CATALOG_PAGE_SIZE;
  if (!raw) return 48;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 48;

  return Math.floor(parsed);
}

const DEFAULT_PUBLIC_CATALOG_CACHE_S_MAXAGE = 10;
const DEFAULT_PUBLIC_CATALOG_CACHE_SWR = 30;

/**
 * Segundos de `s-maxage` para el CDN en `GET /api/public/catalogo`
 * (`PUBLIC_CATALOG_CACHE_S_MAXAGE`, por defecto 10). `0` deshabilita el
 * header de caché y vuelve al comportamiento anterior (cada request pega
 * al origen). Es una variable solo de servidor: no lleva prefijo
 * NEXT_PUBLIC_*.
 */
export function getPublicCatalogCacheSMaxage(): number {
  const raw = process.env.PUBLIC_CATALOG_CACHE_S_MAXAGE;
  if (!raw) return DEFAULT_PUBLIC_CATALOG_CACHE_S_MAXAGE;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_PUBLIC_CATALOG_CACHE_S_MAXAGE;

  return parsed <= 0 ? 0 : Math.floor(parsed);
}

/**
 * Segundos de `stale-while-revalidate` para el CDN en
 * `GET /api/public/catalogo` (`PUBLIC_CATALOG_CACHE_SWR`, por defecto 30).
 * Es una variable solo de servidor: no lleva prefijo NEXT_PUBLIC_*.
 */
export function getPublicCatalogCacheSwr(): number {
  const raw = process.env.PUBLIC_CATALOG_CACHE_SWR;
  if (!raw) return DEFAULT_PUBLIC_CATALOG_CACHE_SWR;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_PUBLIC_CATALOG_CACHE_SWR;
  }

  return Math.floor(parsed);
}
