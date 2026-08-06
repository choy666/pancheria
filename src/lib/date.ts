import type { Duration } from 'date-fns';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';

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
