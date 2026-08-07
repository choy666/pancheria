import type { Duration } from 'date-fns';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';

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

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
}

export function safeFormatDuration(duration: Duration | null, emptyLabel = '0m'): string {
  if (!duration) return emptyLabel;
  const text = formatDuration(duration, {
    format: ['hours', 'minutes'],
    locale: es,
  });
  return text || emptyLabel;
}

export function formatLastUpdated(date: Date | null): string {
  if (!date) return '-';
  return format(date, 'HH:mm:ss', { locale: es });
}

export function formatTime(date: Date | string): string {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function calculateDuration(start: Date | string, end: Date | string | null): Duration | null {
  const endDate = end ? new Date(end) : new Date();
  return intervalToDuration({ start: new Date(start), end: endDate });
}
