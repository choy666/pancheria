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
