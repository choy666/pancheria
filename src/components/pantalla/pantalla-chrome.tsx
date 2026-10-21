'use client';

import { useEffect, useState } from 'react';
import { getBranchTimezone } from '@/config/branch';
import { useClockInterval } from '@/hooks/use-clock-interval';
import { cn } from '@/lib/utils';
import type { Branch } from '@/domain/types';

interface PantallaChromeProps {
  branch: Branch;
  isOpen: boolean;
}

/**
 * Chrome persistente de las pantallas kiosk (`/pantalla`, `/menu`): marca a
 * la izquierda; a la derecha el estado de la sucursal y un reloj en la
 * timezone de la sucursal. Flota sobre el contenido con un gradiente para
 * mantener legibilidad.
 */
export function PantallaChrome({ branch, isOpen }: PantallaChromeProps) {
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

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6">
      <p className="font-heading text-2xl tracking-wide md:text-3xl">
        <span className="text-brand-red">Pan</span>
        <span className="text-brand-mustard">chería</span>
      </p>

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
