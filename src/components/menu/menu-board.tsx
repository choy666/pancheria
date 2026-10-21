'use client';

import {
  productTypeBadgeClasses,
  publicProductTypeLabels,
} from '@/lib/product-style';
import { MENU_GRID_COLS } from '@/lib/menu-pages';
import { cn } from '@/lib/utils';
import { MenuCard } from './menu-card';
import type { MenuPage } from '@/lib/menu-pages';
import type { MenuCardStyle, MenuFontScale } from '@/domain/types';

interface MenuBoardProps {
  page: MenuPage;
  /** Columnas de la grilla en landscape (`menu_settings.grid_columns`). */
  columnas: number;
  fontScale: MenuFontScale;
  cardStyle: MenuCardStyle;
  showDescriptions: boolean;
  /** IDs destacados de la curaduría (marca "Recomendado" en la tarjeta). */
  destacados: ReadonlySet<number>;
}

// Clases estáticas por cantidad de columnas (Tailwind no admite
// interpolación); la grilla admite 3–5, con `MENU_GRID_COLS` como fallback.
const GRID_COLS_CLASS: Record<number, string> = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/**
 * Una página del menú digital: cabezal por categoría con sus tarjetas en
 * grilla. Cada sección crece en proporción a las filas que consume
 * (cabezal + filas de tarjetas) para repartir la altura útil de la TV sin
 * scroll; la paginación de `buildMenuPages` garantiza que el contenido
 * entra en la pantalla.
 *
 * Una última fila incompleta de la grilla (p. ej. 11 ítems en 3 columnas
 * dejan una fila de 2) queda alineada a la izquierda: centrar una fila
 * corta requeriría reestructurar la grilla y no compensa visualmente.
 */
export function MenuBoard({
  page,
  columnas,
  fontScale,
  cardStyle,
  showDescriptions,
  destacados,
}: MenuBoardProps) {
  const gridColsClass = GRID_COLS_CLASS[columnas] ?? GRID_COLS_CLASS[MENU_GRID_COLS];

  return (
    <div
      data-testid="menu-board"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-6 pb-5 md:gap-6 md:px-12"
    >
      {page.groups.map((group) => {
        const rows = Math.ceil(group.items.length / columnas);
        return (
          <section
            key={group.type}
            data-testid="menu-group"
            data-product-type={group.type}
            className="flex min-h-0 flex-col gap-3 md:gap-4"
            style={{ flex: `${1 + rows} 1 0%` }}
          >
            <header className="flex items-center gap-3">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-semibold uppercase tracking-widest md:text-base',
                  productTypeBadgeClasses[group.type]
                )}
              >
                {publicProductTypeLabels[group.type]}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-white/15" />
            </header>

            <div
              className={cn(
                'grid min-h-0 flex-1 grid-cols-2 gap-3 md:gap-5',
                gridColsClass
              )}
              style={{
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {group.items.map((product) => (
                <MenuCard
                  key={product.id}
                  product={product}
                  columnas={columnas}
                  fontScale={fontScale}
                  cardStyle={cardStyle}
                  showDescription={showDescriptions}
                  featured={destacados.has(product.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
