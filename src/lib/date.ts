import { formatDuration, type Duration } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBranchTimezone } from '@/config/branch';

/**
 * Normaliza un valor de fecha al inicio del día en UTC.
 * Útil para comparar días enteros sin depender de la zona horaria del servidor.
 */
export function startOfDayUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? parseDateStringUTC(date) : new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/**
 * Normaliza un valor de fecha al final del día en UTC.
 */
export function endOfDayUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? parseDateStringUTC(date) : new Date(date);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Convierte un string de fecha a un objeto Date interpretado como UTC.
 * Si el string tiene formato ISO con zona, se respeta.
 * Si es solo 'YYYY-MM-DD', se interpreta como inicio de ese día en UTC.
 */
export function parseDateStringUTC(input: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00.000Z`);
  }
  return new Date(input);
}

/**
 * Devuelve la fecha y hora actual como objeto Date.
 */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Partes de fecha/hora de un instante en una timezone dada. Las fechas de
 * negocio se muestran en la timezone de sucursal
 * (`NEXT_PUBLIC_BRANCH_TIMEZONE`, default America/Argentina/Buenos_Aires)
 * para coincidir con la lógica de turnos y alertas de caja, que la usa.
 */
function dateTimePartsInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Clave de día calendario 'YYYY-MM-DD' en la timezone dada. Sirve para
 * comparar "mismo día / día siguiente" sin depender de la timezone del
 * runtime (navegador o servidor).
 */
export function dateKeyInTimezone(
  date: Date | string,
  timeZone = getBranchTimezone()
): string {
  const p = dateTimePartsInTimezone(new Date(date), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Nombre del día de la semana en español, en la timezone dada. */
export function weekdayNameInTimezone(
  date: Date | string,
  timeZone = getBranchTimezone()
): string {
  return new Intl.DateTimeFormat('es', {
    timeZone,
    weekday: 'long',
  }).format(new Date(date));
}

export function formatDateTime(
  date: Date | string | null,
  timeZone = getBranchTimezone()
): string {
  if (!date) return '-';
  const p = dateTimePartsInTimezone(new Date(date), timeZone);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function safeFormatDuration(duration: Duration | null, emptyLabel = '0m'): string {
  if (!duration) return emptyLabel;
  const text = formatDuration(duration, {
    format: ['hours', 'minutes'],
    locale: es,
  });
  return text || emptyLabel;
}

export function formatLastUpdated(
  date: Date | null,
  timeZone = getBranchTimezone()
): string {
  if (!date) return '-';
  const p = dateTimePartsInTimezone(date, timeZone);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function formatTime(
  date: Date | string,
  timeZone = getBranchTimezone()
): string {
  const p = dateTimePartsInTimezone(new Date(date), timeZone);
  return `${p.hour}:${p.minute}`;
}


