'use client';

import { Badge } from '@/components/ui/badge';
import { DAYS } from '@/lib/branch-helpers';
import { formatNextShiftStart } from '@/lib/date';
import type { CashRegisterShiftInfoDTO } from '@/domain/types';

interface CashRegisterShiftBadgeProps {
  estadoTurno: CashRegisterShiftInfoDTO | null | undefined;
  /**
   * `light` pinta sobre superficies `[data-theme='light']` (`/ventas`); sin
   * valor conserva las clases pensadas para el panel oscuro (`/cierre`).
   */
  dataTheme?: 'light';
}

function formatShiftSlot(slot: { dayOfWeek: number; open: string; close: string; start: string; end: string }): string {
  const dayName = DAYS[slot.dayOfWeek];
  return `${dayName} de ${slot.open} a ${slot.close}`;
}

export function CashRegisterShiftBadge({ estadoTurno, dataTheme }: CashRegisterShiftBadgeProps) {
  if (!estadoTurno) {
    return null;
  }

  const { status, currentShift, nextShiftStart } = estadoTurno;

  if (status === 'sin_horarios') {
    return (
      <Badge
        variant="outline"
        className="text-muted-foreground"
        data-testid="cash-register-shift-badge"
        data-shift-status={status}
      >
        Sin horarios configurados
      </Badge>
    );
  }

  if (currentShift) {
    return (
      <Badge
        variant="default"
        className={
          dataTheme === 'light'
            ? 'bg-green-500/15 text-green-700 border-green-600/40'
            : 'bg-green-500/20 text-green-400 border-green-500/30'
        }
        data-testid="cash-register-shift-badge"
        data-shift-status={status}
      >
        En turno: {formatShiftSlot(currentShift)}
      </Badge>
    );
  }

  if (nextShiftStart) {
    const nextShiftText = formatNextShiftStart(nextShiftStart);
    return (
      <Badge
        variant="outline"
        className={
          dataTheme === 'light'
            ? 'text-amber-700 border-amber-500/40'
            : 'text-amber-400 border-amber-500/30'
        }
        data-testid="cash-register-shift-badge"
        data-shift-status={status}
      >
        Próximo turno: {nextShiftText}
      </Badge>
    );
  }

  return null;
}
