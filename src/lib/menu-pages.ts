import { groupPublicProductsByType } from '@/lib/catalog';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { ProductGroup } from '@/lib/product-grouping';
import type {
  MenuCardStyle,
  MenuFontScale,
  MenuSortOrder,
} from '@/domain/types';

/**
 * Columnas default de la grilla del menú en landscape (breakpoint `md` en
 * adelante): es el valor que usa `buildMenuPages` cuando la sucursal no
 * personaliza `gridColumns`, y el tope histórico de la grilla (`gridColumns`
 * admite 3–5). La paginación cuenta "filas" sobre esta base, así que hay que
 * mantenerla sincronizada con las clases de la grilla del board.
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
  gridColumns: number;
  fontScale: MenuFontScale;
  showDescriptions: boolean;
  cardStyle: MenuCardStyle;
  sortOrder: MenuSortOrder;
  showQrStrip: boolean;
  hiddenProductIds: number[];
  featuredProductIds: number[];
  qrStripText: string;
};

/** Opciones de paginación del tablero, derivadas de `MenuSettings`. */
export type BuildMenuPagesOptions = {
  /** Presupuesto de filas por página (cabezales + filas de tarjetas). */
  filasPagina: number;
  /** Columnas de la grilla en landscape; default `MENU_GRID_COLS`. */
  columnas?: number;
  /** Productos que la sucursal ocultó del tablero. */
  ocultos?: ReadonlySet<number>;
  /**
   * Productos destacados: encabezan su categoría (la tarjeta además lleva
   * la marca "Recomendado", que decide el board). Si un ID está también en
   * `ocultos`, el ocultamiento gana: el producto ni siquiera llega acá.
   */
  destacados?: ReadonlySet<number>;
  /**
   * Orden de los ítems dentro de cada categoría; default `catalog`
   * (conserva el orden del agrupamiento público: alfabético por nombre,
   * con la sub-prioridad de insumos críticos en `critical_supply`).
   */
  orden?: MenuSortOrder;
};

/** Filas de grilla que consume un grupo: el cabezal + sus filas de tarjetas. */
function groupLines(group: ProductGroup<unknown>, columnas: number): number {
  return 1 + Math.ceil(group.items.length / columnas);
}

/**
 * Ordena los ítems de cada grupo según la curaduría de la sucursal: los
 * destacados primero (entre sí ordenados por el mismo criterio que el
 * resto), después el orden elegido. Con `catalog` el comparador devuelve 0
 * entre ítems del mismo nivel de destacado: como el sort de JS es estable,
 * se conserva el orden del agrupamiento (alfabético + sub-prioridad de
 * insumos críticos). Con orden por precio ese orden reemplaza a la
 * sub-prioridad — el precio es lo que el criterio controla.
 */
function sortGroupItems(
  groups: ProductGroup<PublicCatalogProduct>[],
  destacados: ReadonlySet<number> | undefined,
  orden: MenuSortOrder
): void {
  const hayDestacados = destacados !== undefined && destacados.size > 0;
  if (!hayDestacados && orden === 'catalog') return;

  for (const group of groups) {
    group.items = [...group.items].sort((a, b) => {
      const destacadoA = destacados?.has(a.id) ? 0 : 1;
      const destacadoB = destacados?.has(b.id) ? 0 : 1;
      if (destacadoA !== destacadoB) return destacadoA - destacadoB;

      if (orden === 'price_asc') {
        return a.price - b.price || a.name.localeCompare(b.name);
      }
      if (orden === 'price_desc') {
        return b.price - a.price || a.name.localeCompare(b.name);
      }
      return 0;
    });
  }
}

/**
 * Reparte el catálogo vendible en páginas del menú respetando el orden
 * público de grupos. Reglas:
 *
 * - Productos con `availability <= 0` no se muestran (igual que en
 *   `/pantalla`: la TV no anuncia lo que no se puede vender).
 * - Los productos de `ocultos` tampoco: la sucursal los ocultó del
 *   tablero desde el panel (siguen vendiéndose por caja y por el QR).
 *   El ocultamiento se evalúa antes que el destacado, así que un ID
 *   presente en ambas listas queda oculto.
 * - Dentro de cada categoría los destacados van primero y el resto sigue
 *   el `orden` elegido (`sortGroupItems`); el orden de los grupos en la
 *   página sigue siendo el del agrupamiento público (`typePriority`).
 * - Cada cabezal de categoría y cada fila de tarjetas consumen una "fila"
 *   del presupuesto `filasPagina`, para que el contenido no desborde el alto de
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
  {
    filasPagina,
    columnas = MENU_GRID_COLS,
    ocultos,
    destacados,
    orden = 'catalog',
  }: BuildMenuPagesOptions
): MenuPage[] {
  const groups = groupPublicProductsByType(
    products.filter(
      (product) => product.availability > 0 && !ocultos?.has(product.id)
    )
  );
  sortGroupItems(groups, destacados, orden);

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
    const lines = groupLines(group, columnas);

    if (lines <= filasPagina) {
      if (usedLines + lines > filasPagina) flush();
      current.push(group);
      usedLines += lines;
      continue;
    }

    // La categoría sola supera el presupuesto: se parte en páginas propias
    // con el cabezal repetido. `filasPagina - 1` puede ser 0 con la config
    // mínima (1): se fuerza al menos una fila de tarjetas por página.
    flush();
    const itemsPerPage = Math.max(1, filasPagina - 1) * columnas;
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
