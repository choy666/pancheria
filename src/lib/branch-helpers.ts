import type {
  Branch,
  BranchOpeningHours,
  BranchPhone,
  BranchSocialLink,
  BranchSocialNetwork,
} from '@/domain/types';
import { ValidationError } from '@/domain/errors';
import { getBranchTimezone } from '@/config/branch';

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const DAY_MINUTES = 24 * 60;
const WEEK_MINUTES = 7 * DAY_MINUTES;
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Valida las franjas horarias de una sucursal.
 *
 * Semántica overnight: `close < open` significa que el turno termina al día
 * siguiente (ej. 20:00 a 02:00). `close === open` sigue siendo inválido.
 * El control de solapamientos expande cada franja a intervalos de minutos
 * sobre la semana completa (incluida la semana siguiente), de modo que un
 * turno overnight del domingo también se detecte contra las franjas del lunes.
 */
export function validateOpeningHours(
  hours: unknown
): asserts hours is BranchOpeningHours[] {
  if (!Array.isArray(hours)) {
    throw new ValidationError('Los horarios de apertura deben ser un arreglo.');
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
      throw new ValidationError(
        'Cada horario debe tener dayOfWeek (0-6), open y close en formato HH:mm.'
      );
    }

    if (item.close === item.open) {
      throw new ValidationError(
        `El horario de cierre debe ser distinto al de apertura (${item.open} - ${item.close}). Si el turno termina después de medianoche, indicá una hora de cierre menor a la de apertura.`
      );
    }
  }

  const seen = new Set<string>();
  for (const item of hours) {
    const key = `${item.dayOfWeek}-${item.open}-${item.close}`;
    if (seen.has(key)) {
      throw new ValidationError('No puede haber horarios duplicados para el mismo día.');
    }
    seen.add(key);
  }

  // Intervalos semanales en minutos; los overnight terminan en el día siguiente.
  const intervals = hours.map((item) => {
    const start = item.dayOfWeek * DAY_MINUTES + minutesOf(item.open);
    const duration =
      minutesOf(item.close) > minutesOf(item.open)
        ? minutesOf(item.close) - minutesOf(item.open)
        : minutesOf(item.close) + DAY_MINUTES - minutesOf(item.open);
    return { item, start, end: start + duration };
  });

  // Duplicar cada intervalo desplazado una semana para detectar cruces con la
  // continuación overnight de franjas de días anteriores (Dom→Lun incluido).
  const expanded = intervals.flatMap((i) => [
    i,
    { item: i.item, start: i.start + WEEK_MINUTES, end: i.end + WEEK_MINUTES },
  ]);

  for (let i = 0; i < expanded.length; i += 1) {
    for (let j = i + 1; j < expanded.length; j += 1) {
      const a = expanded[i];
      const b = expanded[j];
      if (a.start < b.end && b.start < a.end) {
        throw new ValidationError(
          `Los horarios del ${DAYS[a.item.dayOfWeek]} (${a.item.open} - ${a.item.close}) y del ${DAYS[b.item.dayOfWeek]} (${b.item.open} - ${b.item.close}) se solapan.`
        );
      }
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

    // Las filas parciales (open sin close o viceversa) se conservan para que
    // `validateOpeningHours` muestre un error explícito en vez de descartarlas
    // en silencio.
    if (open || close) {
      hours.push({ dayOfWeek, open, close });
    }
  }

  return hours;
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number;
};

function getLocalParts(now: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
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
    // Algunos entornos reportan la medianoche como 24 con hourCycle h23.
    hours: Number(parts.hour) % 24,
    minutes: Number(parts.minute),
    seconds: Number(parts.second),
    dayOfWeek: dateAtNoon.getUTCDay(),
  };
}

/**
 * Offset en milisegundos entre la hora local de `timeZone` y UTC para el
 * instante dado (localAsUtc - utc).
 */
function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const local = getLocalParts(instant, timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hours,
    local.minutes,
    local.seconds
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Convierte una hora local (`HH:mm`) de una fecha civil de la timezone dada al
 * instante UTC correspondiente. Hace una doble medición del offset para
 * absorber transiciones DST: si la hora local cae en un hueco inexistente, el
 * resultado queda desplazado por la transición (comportamiento aceptable, la
 * timezone por defecto no tiene DST).
 */
function localTimeToUtc(
  year: number,
  month: number,
  day: number,
  time: string,
  timeZone: string
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  const offset = timezoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  const adjusted = timezoneOffsetMs(new Date(utc), timeZone);
  if (adjusted !== offset) {
    utc = guess - adjusted;
  }
  return new Date(utc);
}

/**
 * Un turno resuelto a instantes concretos. `start`/`end` son UTC reales; para
 * turnos overnight `end` cae en el día civil siguiente al de `dayOfWeek`.
 */
export type ShiftInterval = BranchOpeningHours & {
  start: Date;
  end: Date;
};

/**
 * Expande los horarios semanales a intervalos concretos entre los días civiles
 * locales de `from` y `to` (inclusive), agregando el día previo a `from` para
 * capturar turnos overnight en curso.
 */
export function buildShiftIntervals(
  openingHours: BranchOpeningHours[] | null | undefined,
  from: Date,
  to: Date,
  timeZone = getBranchTimezone()
): ShiftInterval[] {
  if (!openingHours || openingHours.length === 0) return [];

  const fromLocal = getLocalParts(from, timeZone);
  const toLocal = getLocalParts(to, timeZone);

  // Cursor de fecha civil (no es un instante real; solo transporta y/m/d).
  const cursor = new Date(
    Date.UTC(fromLocal.year, fromLocal.month - 1, fromLocal.day)
  );
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  const lastDay = new Date(
    Date.UTC(toLocal.year, toLocal.month - 1, toLocal.day)
  );

  const intervals: ShiftInterval[] = [];

  while (cursor <= lastDay) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const dayOfWeek = cursor.getUTCDay();

    for (const slot of openingHours) {
      if (slot.dayOfWeek !== dayOfWeek) continue;

      const start = localTimeToUtc(year, month, day, slot.open, timeZone);
      let end = localTimeToUtc(year, month, day, slot.close, timeZone);
      if (end <= start) {
        // Turno overnight (o franja degenerada 00:00-00:00): el cierre
        // corresponde al día civil siguiente.
        const next = new Date(Date.UTC(year, month - 1, day));
        next.setUTCDate(next.getUTCDate() + 1);
        end = localTimeToUtc(
          next.getUTCFullYear(),
          next.getUTCMonth() + 1,
          next.getUTCDate(),
          slot.close,
          timeZone
        );
      }

      intervals.push({ ...slot, start, end });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function dayLabel(start: Date, now: Date, timeZone: string): string {
  const startLocal = getLocalParts(start, timeZone);
  const nowLocal = getLocalParts(now, timeZone);
  const startDay = Date.UTC(
    startLocal.year,
    startLocal.month - 1,
    startLocal.day
  );
  const nowDay = Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day);
  const diffDays = Math.round((startDay - nowDay) / DAY_MS);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  return DAYS[startLocal.dayOfWeek];
}

export function isBranchOpen(branch: Branch, now: Date = new Date()): boolean {
  if (!branch.openingHours || branch.openingHours.length === 0) return false;

  const tz = getBranchTimezone();
  return buildShiftIntervals(branch.openingHours, now, now, tz).some(
    (interval) => interval.start <= now && now < interval.end
  );
}

export function getCurrentOrNextOpening(
  branch: Branch,
  now: Date = new Date()
): string {
  if (!branch.openingHours || branch.openingHours.length === 0) {
    return 'No hay horarios de apertura configurados.';
  }

  const tz = getBranchTimezone();
  const horizon = new Date(now.getTime() + 8 * DAY_MS);
  const intervals = buildShiftIntervals(branch.openingHours, now, horizon, tz);

  const current = intervals.find(
    (interval) => interval.start <= now && now < interval.end
  );
  const slot = current ?? intervals.find((interval) => interval.start > now);

  if (!slot) {
    return 'No hay horarios de apertura configurados.';
  }

  // `dayLabel` resuelve también el turno en curso: un overnight que abrió
  // ayer se muestra con su día de inicio real, no como "Hoy".
  const label = dayLabel(slot.start, now, tz);
  return `${label} de ${slot.open} a ${slot.close}`;
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

export function getTodayOpening(
  branch: Branch,
  now: Date = new Date()
): string {
  if (!branch.openingHours || branch.openingHours.length === 0) {
    return 'No hay horarios de apertura configurados.';
  }

  const tz = getBranchTimezone();
  const { dayOfWeek } = getLocalParts(now, tz);

  // Un turno overnight del día anterior puede seguir en curso a la madrugada:
  // también cuenta como horario vigente de hoy.
  const ongoing = buildShiftIntervals(branch.openingHours, now, now, tz).find(
    (interval) => interval.start <= now && now < interval.end
  );

  const dayHours = branch.openingHours
    .filter((h) => h.dayOfWeek === dayOfWeek)
    .sort((a, b) => minutesOf(a.open) - minutesOf(b.open));

  const slots = [
    ...(ongoing && ongoing.dayOfWeek !== dayOfWeek
      ? [`de ${ongoing.open} a ${ongoing.close}`]
      : []),
    ...dayHours.map((h) => `de ${h.open} a ${h.close}`),
  ];

  if (slots.length === 0) {
    return 'Hoy no atendemos.';
  }

  return `Hoy ${slots.join(' y ')}`;
}

export function getNextOpening(
  branch: Branch,
  now: Date = new Date()
): string {
  if (!branch.openingHours || branch.openingHours.length === 0) {
    return 'No hay horarios de apertura configurados.';
  }

  const tz = getBranchTimezone();
  const horizon = new Date(now.getTime() + 8 * DAY_MS);
  const next = buildShiftIntervals(branch.openingHours, now, horizon, tz).find(
    (interval) => interval.start > now
  );

  if (!next) {
    return 'No hay horarios de apertura configurados.';
  }

  return `${dayLabel(next.start, now, tz)} de ${next.open} a ${next.close}`;
}

/* ------------------------------------------------------------------------ */
/* Contactos de la sucursal: teléfonos y redes sociales                     */
/* ------------------------------------------------------------------------ */

const MAX_BRANCH_PHONES = 10;
const MAX_BRANCH_SOCIAL_LINKS = 10;
const MAX_PHONE_LABEL_LENGTH = 40;
const MAX_PHONE_NUMBER_LENGTH = 25;
const MAX_SOCIAL_URL_LENGTH = 200;

const PHONE_NUMBER_PATTERN = /^[+0-9][0-9()+.\-\s]{4,24}$/;
const SOCIAL_HANDLE_PATTERN = /^@?[A-Za-z0-9._-]{2,50}$/;

/**
 * Versión por valor del patrón de `normalizeBranchPhones`, para validación
 * en vivo en el cliente (mismo criterio: dígitos, espacios y + ( ) - .).
 */
export function isValidPhoneNumber(value: string): boolean {
  return PHONE_NUMBER_PATTERN.test(value);
}

export const SOCIAL_NETWORK_OPTIONS: {
  value: BranchSocialNetwork;
  label: string;
}[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X' },
  { value: 'otro', label: 'Otra' },
];

const SOCIAL_NETWORK_LABELS = Object.fromEntries(
  SOCIAL_NETWORK_OPTIONS.map((option) => [option.value, option.label])
) as Record<BranchSocialNetwork, string>;

export function getSocialNetworkLabel(network: string): string {
  return (
    SOCIAL_NETWORK_LABELS[network as BranchSocialNetwork] ?? network
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Versión por valor de la regla de `normalizeSocialLinks`, para validación
 * en vivo en el cliente: acepta URL http(s) completa o un handle corto (en
 * WhatsApp, un número de teléfono).
 */
export function isValidSocialTarget(
  network: BranchSocialNetwork,
  value: string
): boolean {
  if (isValidHttpUrl(value)) return true;
  if (network === 'whatsapp') {
    // En WhatsApp el destino suele ser un número de teléfono.
    return PHONE_NUMBER_PATTERN.test(value);
  }
  return SOCIAL_HANDLE_PATTERN.test(value);
}

/**
 * Devuelve un href navegable para una red social, o `null` si el valor es un
 * handle/texto sin URL asociable. Los handles de WhatsApp se traducen a wa.me.
 */
export function getSocialLinkHref(link: BranchSocialLink): string | null {
  const value = link.url.trim();
  if (isValidHttpUrl(value)) return value;
  if (link.network === 'whatsapp') {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 5) return `https://wa.me/${digits}`;
  }
  return null;
}

/**
 * Valida y normaliza los teléfonos de la sucursal. Recorta espacios y exige
 * etiqueta y número en cada entrada.
 */
export function normalizeBranchPhones(phones: unknown): BranchPhone[] {
  if (phones === null || phones === undefined) return [];
  if (!Array.isArray(phones)) {
    throw new ValidationError(
      'Los teléfonos de la sucursal deben ser un arreglo.'
    );
  }
  if (phones.length > MAX_BRANCH_PHONES) {
    throw new ValidationError(
      `No puede haber más de ${MAX_BRANCH_PHONES} teléfonos por sucursal.`
    );
  }

  return phones.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.label !== 'string' ||
      typeof item.number !== 'string'
    ) {
      throw new ValidationError(
        'Cada teléfono debe tener etiqueta (label) y número (number).'
      );
    }

    const label = item.label.trim();
    const number = item.number.trim();

    if (!label || label.length > MAX_PHONE_LABEL_LENGTH) {
      throw new ValidationError(
        `La etiqueta del teléfono es obligatoria (máx. ${MAX_PHONE_LABEL_LENGTH} caracteres).`
      );
    }
    if (!number || number.length > MAX_PHONE_NUMBER_LENGTH) {
      throw new ValidationError(
        `El número del teléfono "${label}" es obligatorio (máx. ${MAX_PHONE_NUMBER_LENGTH} caracteres).`
      );
    }
    if (!PHONE_NUMBER_PATTERN.test(number)) {
      throw new ValidationError(
        `El número de teléfono "${number}" no es válido. Usá solo dígitos, espacios y los símbolos + ( ) - .`
      );
    }

    return { label, number };
  });
}

/**
 * Valida y normaliza las redes sociales. Cada entrada acepta una URL http(s)
 * completa o un handle/identificador corto (en WhatsApp, un número).
 */
export function normalizeSocialLinks(links: unknown): BranchSocialLink[] {
  if (links === null || links === undefined) return [];
  if (!Array.isArray(links)) {
    throw new ValidationError(
      'Las redes sociales de la sucursal deben ser un arreglo.'
    );
  }
  if (links.length > MAX_BRANCH_SOCIAL_LINKS) {
    throw new ValidationError(
      `No puede haber más de ${MAX_BRANCH_SOCIAL_LINKS} redes sociales por sucursal.`
    );
  }

  return links.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.network !== 'string' ||
      typeof item.url !== 'string'
    ) {
      throw new ValidationError(
        'Cada red social debe tener red (network) y enlace (url).'
      );
    }

    const network = item.network.trim().toLowerCase();
    const url = item.url.trim();

    const isKnownNetwork = SOCIAL_NETWORK_OPTIONS.some(
      (option) => option.value === network
    );
    if (!isKnownNetwork) {
      throw new ValidationError(
        `La red social "${item.network}" no es válida. Opciones: ${SOCIAL_NETWORK_OPTIONS.map((o) => o.label).join(', ')}.`
      );
    }
    if (!url || url.length > MAX_SOCIAL_URL_LENGTH) {
      throw new ValidationError(
        `El enlace de ${getSocialNetworkLabel(network)} es obligatorio (máx. ${MAX_SOCIAL_URL_LENGTH} caracteres).`
      );
    }
    if (!isValidSocialTarget(network as BranchSocialNetwork, url)) {
      throw new ValidationError(
        `El enlace de ${getSocialNetworkLabel(network)} no es una URL http(s) ni un identificador válido.`
      );
    }

    return { network: network as BranchSocialNetwork, url };
  });
}

/**
 * Parsea del FormData las filas `phones[i][label|number]` y
 * `socialLinks[i][network|url]` que emite el formulario de sucursal.
 * Descarta filas completamente vacías; las filas parciales llegan al
 * validador y producen un error visible (nunca se descartan en silencio).
 */
export function parseContactsForm(formData: FormData): {
  phones: { label: string; number: string }[];
  socialLinks: { network: string; url: string }[];
} {
  const phoneRows = new Map<number, Record<string, string>>();
  const socialRows = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const phoneMatch = key.match(/^phones\[(\d+)\]\[(label|number)\]$/);
    if (phoneMatch) {
      const index = Number(phoneMatch[1]);
      const row = phoneRows.get(index) ?? {};
      row[phoneMatch[2]] = String(value);
      phoneRows.set(index, row);
      continue;
    }

    const socialMatch = key.match(/^socialLinks\[(\d+)\]\[(network|url)\]$/);
    if (socialMatch) {
      const index = Number(socialMatch[1]);
      const row = socialRows.get(index) ?? {};
      row[socialMatch[2]] = String(value);
      socialRows.set(index, row);
    }
  }

  const phones = [...phoneRows.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const row = phoneRows.get(index) ?? {};
      return {
        label: (row.label ?? '').trim(),
        number: (row.number ?? '').trim(),
      };
    })
    .filter((row) => row.label !== '' || row.number !== '');

  const socialLinks = [...socialRows.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const row = socialRows.get(index) ?? {};
      return {
        network: (row.network ?? '').trim(),
        url: (row.url ?? '').trim(),
      };
    })
    .filter((row) => row.network !== '' || row.url !== '');

  return { phones, socialLinks };
}
