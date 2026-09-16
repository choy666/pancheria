'use client';

import { Badge } from '@/components/ui/badge';
import { getBranchTimezone } from '@/config/branch';
import {
  dateKeyInTimezone,
  formatTime,
  weekdayNameInTimezone,
} from '@/lib/date';
import type { CashRegisterShiftInfoDTO } from '@/domain/types';

interface CashRegisterShiftBadgeProps {
  estadoTurno: CashRegisterShiftInfoDTO | null | undefined;
}

function formatShiftSlot(slot: { dayOfWeek: number; open: string; close: string; start: string; end: string }): string {
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = dayNames[slot.dayOfWeek];
  return `${dayName} de ${slot.open} a ${slot.close}`;
}

function formatNextShiftStart(isoDate: string | null): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const timeZone = getBranchTimezone();
  // Las comparaciones de día y la hora se evalúan en la timezone de
  // sucursal: los turnos se calculan server-side en esa misma timezone.
  const isToday =
    dateKeyInTimezone(date, timeZone) === dateKeyInTimezone(now, timeZone);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isTomorrowDate =
    dateKeyInTimezone(date, timeZone) === dateKeyInTimezone(tomorrow, timeZone);

  const time = formatTime(date, timeZone);

  if (isToday) {
    return `Hoy a las ${time}`;
  }
  if (isTomorrowDate) {
    return `Mañana a las ${time}`;
  }
  return `${weekdayNameInTimezone(date, timeZone)} a las ${time}`;
}

export function CashRegisterShiftBadge({ estadoTurno }: CashRegisterShiftBadgeProps) {
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
        className="bg-green-500/20 text-green-400 border-green-500/30"
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
        className="text-amber-400 border-amber-500/30"
        data-testid="cash-register-shift-badge"
        data-shift-status={status}
      >
        Próximo turno: {nextShiftText}
      </Badge>
    );
  }

  return null;
}
