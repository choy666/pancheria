'use client';

import { useEffect, useState } from 'react';
import { getBranchTimezone } from '@/config/branch';
import { useClockInterval } from '@/hooks/use-clock-interval';
import { BrandMark } from '@/components/publico/brand-mark';
import { splitBrandName } from '@/lib/brand-helpers';
import { cn } from '@/lib/utils';
import type { Branch, BrandSettings } from '@/domain/types';

interface PantallaChromeProps {
  branch: Branch;
  brand: BrandSettings;
  isOpen: boolean;
  /**
   * Mensaje secundario opcional bajo el estado "Cerrado" (solo lo usa
   * `/menu`; `/pantalla` no lo pasa y no muestra nada extra).
   */
  closedHint?: string;
}

/**
 * Chrome persistente de las pantallas kiosk (`/pantalla`, `/menu`): marca a
 * la izquierda (logo y nombre configurados en la página de pedido); a la
 * derecha el estado de la sucursal y un reloj en la timezone de la sucursal.
 * Flota sobre el contenido con un gradiente para mantener legibilidad.
 */
export function PantallaChrome({
  branch,
  brand,
  isOpen,
  closedHint,
}: PantallaChromeProps) {
  // El reloj se renderiza solo tras la hidratación: el instante SSR del
  // servidor y el del cliente nunca coinciden.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  const now = useClockInterval(30_000);
  const clock = mounted
    ? new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: getBranchTimezone(),
      }).format(now)
    : null;

  const brandName = brand.name?.trim() ?? '';
  const { first, rest } = splitBrandName(brandName);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6">
      {(brandName !== '' || brand.logoUpdatedAt !== null) && (
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-white p-1">
            <BrandMark name={brandName || branch.name} logoUpdatedAt={brand.logoUpdatedAt} />
          </span>
          {brandName !== '' && (
            <p className="truncate font-heading text-2xl tracking-wide md:text-3xl">
              <span className="text-brand-red">{first}</span>
              {rest && <span className="text-brand-mustard"> {rest}</span>}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col items-end gap-1 text-right">
        <p className="text-sm font-medium text-white/80 md:text-base">
          {branch.name}
        </p>
        <p
          data-testid="pantalla-status"
          className={cn(
            'flex items-center gap-2 text-xs md:text-sm',
            isOpen ? 'text-green-400' : 'text-amber-400'
          )}
        >
          <span
            className={cn(
              'inline-block size-2 rounded-full',
              isOpen ? 'bg-green-500' : 'bg-amber-500'
            )}
          />
          {isOpen ? 'Abierto' : 'Cerrado'}
        </p>
        {!isOpen && closedHint && (
          <p
            data-testid="pantalla-closed-hint"
            className="max-w-56 text-xs text-white/65 md:max-w-72 md:text-sm"
          >
            {closedHint}
          </p>
        )}
        {clock && (
          <p
            data-testid="pantalla-clock"
            className="font-mono text-xl font-semibold text-white md:text-2xl"
          >
            {clock}
          </p>
        )}
      </div>
    </header>
  );
}
