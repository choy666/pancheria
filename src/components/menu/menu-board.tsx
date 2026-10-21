'use client';

import {
  productTypeBadgeClasses,
  publicProductTypeLabels,
} from '@/lib/product-style';
import { MENU_GRID_COLS } from '@/lib/menu-pages';
import { cn } from '@/lib/utils';
import { MenuCard } from './menu-card';
import type { MenuPage } from '@/lib/menu-pages';

interface MenuBoardProps {
  page: MenuPage;
}

/**
 * Una página del menú digital: cabezal por categoría con sus tarjetas en
 * grilla. Cada sección crece en proporción a las filas que consume
 * (cabezal + filas de tarjetas) para repartir la altura útil de la TV sin
 * scroll; la paginación de `buildMenuPages` garantiza que el contenido
 * entra en la pantalla.
 */
export function MenuBoard({ page }: MenuBoardProps) {
  return (
    <div
      data-testid="menu-board"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-6 pb-5 md:gap-6 md:px-12"
    >
      {page.groups.map((group) => {
        const rows = Math.ceil(group.items.length / MENU_GRID_COLS);
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
              className="grid min-h-0 flex-1 grid-cols-2 gap-3 md:grid-cols-4 md:gap-5"
              style={{
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {group.items.map((product) => (
                <MenuCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
