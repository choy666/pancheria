/**
 * Configuración del menú digital `/menu` (kiosk Smart TV): la carta completa
 * en una grilla paginada por categorías. Los valores se leen de variables de
 * entorno con prefijo NEXT_PUBLIC_* para que estén disponibles en el cliente.
 *
 * No acceder a la base de datos desde este archivo.
 */

const DEFAULT_PAGINA_MS = 12_000;
const DEFAULT_FILAS_PAGINA = 4;

const MIN_PAGINA_MS = 1_000;
const MIN_FILAS = 1;

function readPositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number
): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

/**
 * Duración de cada página del menú cuando el catálogo no entra en una sola
 * pantalla y la grilla rota. `NEXT_PUBLIC_MENU_PAGINA_MS`, por defecto
 * 12000; mínimo efectivo 1000.
 */
export function getMenuPaginaMs(): number {
  return readPositiveInt(
    process.env.NEXT_PUBLIC_MENU_PAGINA_MS,
    DEFAULT_PAGINA_MS,
    MIN_PAGINA_MS
  );
}

/**
 * Presupuesto de filas por página del menú: cada cabezal de categoría y
 * cada fila de tarjetas (grilla de 4 columnas en landscape) consume una
 * fila. Con el default 4 caben, por ejemplo, 12 productos de una misma
 * categoría o 3 categorías de ~4 ítems cada una. `NEXT_PUBLIC_MENU_FILAS_PAGINA`,
 * por defecto 4; mínimo efectivo 1.
 */
export function getMenuFilasPagina(): number {
  return readPositiveInt(
    process.env.NEXT_PUBLIC_MENU_FILAS_PAGINA,
    DEFAULT_FILAS_PAGINA,
    MIN_FILAS
  );
}
