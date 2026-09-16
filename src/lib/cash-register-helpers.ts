import { differenceInMilliseconds } from 'date-fns';
import { getBranchTimezone } from '@/config/branch';
import { getCajaOverdueHours } from '@/config/caja';
import {
  buildShiftIntervals,
  type ShiftInterval,
} from '@/lib/branch-helpers';
import type {
  BranchOpeningHours,
  CashRegisterAlert,
  CashRegisterShiftStatus,
} from '@/domain/types';

export function isCashRegisterOverdue(
  openedAt: Date | string,
  thresholdHours = getCajaOverdueHours(),
  now = new Date()
): boolean {
  const opened = new Date(openedAt);
  return differenceInMilliseconds(now, opened) >= thresholdHours * 60 * 60 * 1000;
}

function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isCashRegisterFromPreviousDay(
  openedAt: Date | string,
  timeZone = getBranchTimezone(),
  now = new Date()
): boolean {
  const opened = new Date(openedAt);
  const openedDate = formatDateInTimezone(opened, timeZone);
  const today = formatDateInTimezone(now, timeZone);
  return openedDate !== today;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Días calendario transcurridos entre dos instantes, evaluados en la timezone
 * de sucursal (no en la del runtime). `formatDateInTimezone` devuelve
 * 'YYYY-MM-DD', que `Date.parse` interpreta como medianoche UTC.
 */
function calendarDaysBetweenInTimezone(
  start: Date,
  end: Date,
  timeZone: string
): number {
  const startDay = Date.parse(formatDateInTimezone(start, timeZone));
  const endDay = Date.parse(formatDateInTimezone(end, timeZone));
  return Math.round((endDay - startDay) / MS_PER_DAY);
}

/**
 * Estado de una caja abierta respecto de los turnos vigentes de la sucursal.
 * `currentShift`/`nextShiftStart` son instantes reales (Date); al serializarse
 * en JSON viajan como ISO (ver `CashRegisterShiftInfoDTO` en domain/types).
 */
export type CashRegisterShiftInfo = {
  status: CashRegisterShiftStatus;
  /** `true` si la caja se abrió dentro de una franja horaria configurada. */
  aperturaEnTurno: boolean;
  currentShift: ShiftInterval | null;
  nextShiftStart: Date | null;
};

/**
 * Cantidad de días hacia adelante que se escanean para ubicar el próximo
 * turno. Cubre una semana completa más un margen para fechas cruzadas.
 */
const NEXT_SHIFTS_HORIZON_DAYS = 8;

/**
 * Única fuente de verdad del estado de una caja abierta. Función pura y
 * server-safe: recibe los horarios vigentes de la sucursal (no un snapshot)
 * y la timezone de sucursal.
 *
 * Semántica (decisión D2, literal):
 * - `en_turno`: la caja sigue dentro del turno en el que se abrió.
 * - `fuera_de_horario`: el turno terminó (o la caja se abrió en un hueco) y
 *   todavía no arrancó el siguiente turno configurado.
 * - `recomendar_cierre`: ya comenzó el primer turno posterior a la apertura;
 *   si la caja se abrió en un hueco, el aviso aparece al inicio literal de
 *   ese primer turno posterior.
 * - `sin_horarios`: la sucursal no configuró horarios; corresponde el
 *   fallback por fecha calendario y umbral (`resolveCashRegisterAlert`).
 *
 * Para cambiar D2 a "anclar" una apertura en hueco al turno siguiente, basta
 * excluir el primer turno posterior cuando `aperturaEnTurno` sea `false`.
 */
export function getCashRegisterShiftStatus(
  openedAt: Date | string,
  openingHours: BranchOpeningHours[] | null | undefined,
  now: Date = new Date(),
  timeZone = getBranchTimezone()
): CashRegisterShiftInfo {
  if (!openingHours || openingHours.length === 0) {
    return {
      status: 'sin_horarios',
      aperturaEnTurno: false,
      currentShift: null,
      nextShiftStart: null,
    };
  }

  const opened = new Date(openedAt);
  const horizon = new Date(
    now.getTime() + NEXT_SHIFTS_HORIZON_DAYS * 24 * 60 * 60 * 1000
  );
  const intervals = buildShiftIntervals(openingHours, opened, horizon, timeZone);

  const currentShift =
    intervals.find(
      (interval) => interval.start <= now && now < interval.end
    ) ?? null;
  const aperturaEnTurno = intervals.some(
    (interval) => interval.start <= opened && opened < interval.end
  );
  const nextShiftStart =
    intervals.find((interval) => interval.start > now)?.start ?? null;

  if (currentShift && opened >= currentShift.start) {
    return {
      status: 'en_turno',
      aperturaEnTurno,
      currentShift,
      nextShiftStart,
    };
  }

  const comenzoTurnoPosterior = intervals.some(
    (interval) => interval.start > opened && interval.start <= now
  );

  if (comenzoTurnoPosterior) {
    return {
      status: 'recomendar_cierre',
      aperturaEnTurno,
      currentShift,
      nextShiftStart,
    };
  }

  return {
    status: 'fuera_de_horario',
    aperturaEnTurno,
    currentShift,
    nextShiftStart,
  };
}

/**
 * Fallback legacy para sucursales sin horarios configurados (o para payloads
 * viejos que no traen el estado calculado): fecha calendario + umbral de
 * horas configurable (`CAJA_OVERDUE_HOURS`, default 12). Uso interno: los
 * componentes acceden vía `resolveDisplayedCashRegisterAlert`.
 */
function legacyCashRegisterAlert(
  openedAt: Date | string,
  now = new Date(),
  timeZone = getBranchTimezone()
): CashRegisterAlert | null {
  if (isCashRegisterFromPreviousDay(openedAt, timeZone, now)) {
    return {
      code: 'dia_anterior',
      severity: 'warning',
      detalle: {
        diasAbierta: calendarDaysBetweenInTimezone(
          new Date(openedAt),
          now,
          timeZone
        ),
      },
    };
  }

  const horasUmbral = getCajaOverdueHours();
  if (isCashRegisterOverdue(openedAt, horasUmbral, now)) {
    return {
      code: 'excedida',
      severity: 'warning',
      detalle: { horasUmbral },
    };
  }

  return null;
}

/**
 * Resuelve el aviso que debe mostrar la UI para una caja abierta. Prioriza el
 * `alertaCaja` calculado por el servidor (única fuente de verdad); si el
 * payload es viejo y no lo incluye (`undefined`), aplica el fallback legacy
 * sobre `openedAt`. Centraliza la decisión para que los componentes de caja
 * no dupliquen el condicional.
 */
export function resolveDisplayedCashRegisterAlert(
  alertaCaja: CashRegisterAlert | null | undefined,
  openedAt: Date | string,
  now: Date = new Date(),
  timeZone = getBranchTimezone()
): CashRegisterAlert | null {
  return alertaCaja === undefined
    ? legacyCashRegisterAlert(openedAt, now, timeZone)
    : alertaCaja;
}

/**
 * Traduce el estado de turno de la caja al aviso que debe mostrar la UI.
 * Ningún aviso bloquea operaciones: son informativos o de recomendación.
 */
export function resolveCashRegisterAlert(
  openedAt: Date | string,
  openingHours: BranchOpeningHours[] | null | undefined,
  now: Date = new Date(),
  timeZone = getBranchTimezone()
): CashRegisterAlert | null {
  const info = getCashRegisterShiftStatus(openedAt, openingHours, now, timeZone);

  if (info.status === 'sin_horarios') {
    return legacyCashRegisterAlert(openedAt, now, timeZone);
  }

  if (info.status === 'fuera_de_horario') {
    return {
      code: 'fuera_de_horario',
      severity: 'info',
      detalle: {
        proximoTurno: info.nextShiftStart?.toISOString() ?? undefined,
      },
    };
  }

  if (info.status === 'recomendar_cierre') {
    return {
      code: 'cierre_recomendado',
      severity: 'warning',
      detalle: { aperturaEnTurno: info.aperturaEnTurno },
    };
  }

  return null;
}
