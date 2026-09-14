'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
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
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now);
  isTomorrow.setDate(isTomorrow.getDate() + 1);
  const isTomorrowDate = date.toDateString() === isTomorrow.toDateString();
  
  const time = format(date, 'HH:mm', { locale: es });
  
  if (isToday) {
    return `Hoy a las ${time}`;
  }
  if (isTomorrowDate) {
    return `Mañana a las ${time}`;
  }
  return format(date, "EEEE 'a las' HH:mm", { locale: es });
}

export function CashRegisterShiftBadge({ estadoTurno }: CashRegisterShiftBadgeProps) {
  if (!estadoTurno) {
    return null;
  }

  const { status, currentShift, nextShiftStart } = estadoTurno;

  if (status === 'sin_horarios') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sin horarios configurados
      </Badge>
    );
  }

  if (currentShift) {
    return (
      <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
        En turno: {formatShiftSlot(currentShift)}
      </Badge>
    );
  }

  if (nextShiftStart) {
    const nextShiftText = formatNextShiftStart(nextShiftStart);
    return (
      <Badge variant="outline" className="text-amber-400 border-amber-500/30">
        Próximo turno: {nextShiftText}
      </Badge>
    );
  }

  return null;
}
