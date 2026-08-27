import type { Branch, BranchOpeningHours } from '@/domain/types';

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function validateOpeningHours(
  hours: unknown
): asserts hours is BranchOpeningHours[] {
  if (!Array.isArray(hours)) {
    throw new Error('Los horarios de apertura deben ser un arreglo.');
  }

  for (const item of hours) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.dayOfWeek !== 'number' ||
      item.dayOfWeek < 0 ||
      item.dayOfWeek > 6 ||
      typeof item.open !== 'string' ||
      typeof item.close !== 'string' ||
      !isValidTime(item.open) ||
      !isValidTime(item.close)
    ) {
      throw new Error(
        'Cada horario debe tener dayOfWeek (0-6), open y close en formato HH:mm.'
      );
    }

    if (item.close <= item.open) {
      throw new Error(
        `El horario de cierre debe ser posterior al de apertura (${item.open} - ${item.close}).`
      );
    }
  }

  const seen = new Set<string>();
  for (const item of hours) {
    const key = `${item.dayOfWeek}-${item.open}-${item.close}`;
    if (seen.has(key)) {
      throw new Error('No puede haber horarios duplicados para el mismo día.');
    }
    seen.add(key);
  }

  const sorted = [...hours].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return minutesOf(a.open) - minutesOf(b.open);
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (
      prev.dayOfWeek === current.dayOfWeek &&
      minutesOf(prev.close) > minutesOf(current.open)
    ) {
      throw new Error(
        `Los horarios del ${DAYS[current.dayOfWeek]} se solapan (${prev.open} - ${prev.close} y ${current.open} - ${current.close}).`
      );
    }
  }
}

export function parseOpeningHoursForm(
  formData: FormData
): BranchOpeningHours[] {
  const hours: BranchOpeningHours[] = [];
  const entries = Array.from(formData.entries());

  const openKeys = entries
    .filter(([key]) => key.startsWith('openingHours[') && key.includes('][open]'))
    .map(([key]) => key)
    .sort();

  for (const openKey of openKeys) {
    const match = openKey.match(/^openingHours\[(\d+)\]\[(\d+)\]\[(\w+)\]$/);
    if (!match) continue;
    const dayOfWeek = Number(match[1]);
    const slotIndex = Number(match[2]);
    const open = formData.get(openKey)?.toString() ?? '';
    const closeKey = `openingHours[${dayOfWeek}][${slotIndex}][close]`;
    const close = formData.get(closeKey)?.toString() ?? '';

    if (open && close) {
      hours.push({ dayOfWeek, open, close });
    }
  }

  return hours;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getLocalParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  const dateAtNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return {
    year,
    month,
    day,
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    dayOfWeek: dateAtNoon.getUTCDay(),
  };
}

function getBranchTimeZone(): string {
  return (
    process.env.NEXT_PUBLIC_BRANCH_TIMEZONE ||
    'America/Argentina/Buenos_Aires'
  );
}

export function isBranchOpen(branch: Branch, now: Date = new Date()): boolean {
  if (!branch.openingHours || branch.openingHours.length === 0) return false;

  const tz = getBranchTimeZone();
  const { dayOfWeek } = getLocalParts(now, tz);

  const todayHours = branch.openingHours.filter((h) => h.dayOfWeek === dayOfWeek);
  if (todayHours.length === 0) return false;

  const { hours, minutes } = getLocalParts(now, tz);
  const currentMinutes = hours * 60 + minutes;

  return todayHours.some((h) => {
    const open = minutesOf(h.open);
    const close = minutesOf(h.close);
    return currentMinutes >= open && currentMinutes < close;
  });
}

export function getCurrentOrNextOpening(
  branch: Branch,
  now: Date = new Date()
): string {
  if (!branch.openingHours || branch.openingHours.length === 0) {
    return 'No hay horarios de apertura configurados.';
  }

  const tz = getBranchTimeZone();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const local = getLocalParts(date, tz);
    const dayOfWeek = local.dayOfWeek;
    const dayHours = branch.openingHours
      .filter((h) => h.dayOfWeek === dayOfWeek)
      .sort((a, b) => minutesOf(a.open) - minutesOf(b.open));

    if (dayHours.length > 0) {
      const currentMinutes =
        offset === 0 ? local.hours * 60 + local.minutes : -1;
      const matchingSlot = dayHours.find(
        (h) =>
          currentMinutes >= minutesOf(h.open) &&
          currentMinutes < minutesOf(h.close)
      );
      const nextSlot = dayHours.find((h) => minutesOf(h.open) > currentMinutes);
      const slot = matchingSlot ?? nextSlot;

      if (slot) {
        const dayName =
          offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : DAYS[dayOfWeek];
        return `${dayName}: de ${slot.open} a ${slot.close}`;
      }
    }
  }

  return 'No hay horarios de apertura configurados.';
}

export function formatOpeningHours(hours: BranchOpeningHours[]): string {
  if (!hours || hours.length === 0) return 'Sin horarios configurados';

  return hours
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return minutesOf(a.open) - minutesOf(b.open);
    })
    .map((h) => `${DAYS[h.dayOfWeek]}: ${h.open} - ${h.close}`)
    .join(', ');
}
