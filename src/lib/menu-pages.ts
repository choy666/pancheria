import { groupPublicProductsByType } from '@/lib/catalog';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { ProductGroup } from '@/lib/product-grouping';

/**
 * Columnas de la grilla del menú en landscape (breakpoint `md` en adelante):
 * la paginación cuenta "filas" sobre esta base, así que hay que mantenerla
 * sincronizada con las clases de la grilla del board (`md:grid-cols-4`).
 */
export const MENU_GRID_COLS = 4;

/**
 * Una página del menú digital: los grupos que se muestran juntos, en el
 * orden público del catálogo (promos → bebidas → extras).
 */
export type MenuPage = {
  groups: ProductGroup<PublicCatalogProduct>[];
};

/**
 * Configuración efectiva del menú digital de una sucursal (`menu_settings`
 * o los defaults de `src/config/menu.ts` cuando no hay fila). Viaja dentro
 * del `MenuSnapshot` para que la TV aplique los cambios en el próximo poll.
 */
export type MenuSettings = {
  paginaMs: number;
  filasPagina: number;
  showQrStrip: boolean;
  hiddenProductIds: number[];
};

/** Filas de grilla que consume un grupo: el cabezal + sus filas de tarjetas. */
function groupLines(group: ProductGroup<unknown>): number {
  return 1 + Math.ceil(group.items.length / MENU_GRID_COLS);
}

/**
 * Reparte el catálogo vendible en páginas del menú respetando el orden
 * público de grupos. Reglas:
 *
 * - Productos con `availability <= 0` no se muestran (igual que en
 *   `/pantalla`: la TV no anuncia lo que no se puede vender).
 * - Los productos de `hiddenProductIds` tampoco: la sucursal los ocultó del
 *   tablero desde el panel (siguen vendiéndose por caja y por el QR).
 * - Cada cabezal de categoría y cada fila de tarjetas consumen una "fila"
 *   del presupuesto `maxFilas`, para que el contenido no desborde el alto de
 *   la TV.
 * - Los grupos se empacan enteros siempre que entran; un cabezal nunca queda
 *   huérfano al pie de una página.
 * - Una categoría que supera sola el presupuesto se parte en varias páginas
 *   con el cabezal repetido.
 * - Devuelve siempre ≥1 página; con catálogo vacío la única página viene con
 *   `groups: []` y el board muestra el estado vacío.
 */
export function buildMenuPages(
  products: PublicCatalogProduct[],
  maxFilas: number,
  hiddenProductIds?: ReadonlySet<number>
): MenuPage[] {
  const groups = groupPublicProductsByType(
    products.filter(
      (product) =>
        product.availability > 0 && !hiddenProductIds?.has(product.id)
    )
  );

  const pages: MenuPage[] = [];
  let current: ProductGroup<PublicCatalogProduct>[] = [];
  let usedLines = 0;

  const flush = () => {
    if (current.length > 0) {
      pages.push({ groups: current });
      current = [];
      usedLines = 0;
    }
  };

  for (const group of groups) {
    const lines = groupLines(group);

    if (lines <= maxFilas) {
      if (usedLines + lines > maxFilas) flush();
      current.push(group);
      usedLines += lines;
      continue;
    }

    // La categoría sola supera el presupuesto: se parte en páginas propias
    // con el cabezal repetido. `maxFilas - 1` puede ser 0 con la config
    // mínima (1): se fuerza al menos una fila de tarjetas por página.
    flush();
    const itemsPerPage = Math.max(1, maxFilas - 1) * MENU_GRID_COLS;
    for (let i = 0; i < group.items.length; i += itemsPerPage) {
      pages.push({
        groups: [
          { type: group.type, items: group.items.slice(i, i + itemsPerPage) },
        ],
      });
    }
  }

  flush();

  if (pages.length === 0) {
    pages.push({ groups: [] });
  }

  return pages;
}
