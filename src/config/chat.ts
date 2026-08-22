/**
 * Configuración del chat de pedidos. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getChatRefreshIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS;
  if (!raw) return 5_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 5_000;

  return parsed;
}

export function getChatMaxTextLength(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH;
  if (!raw) return 1_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 1_000;

  return parsed;
}

export function getChatRateLimitWindowMs(): number {
  const raw = process.env.PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS;
  if (!raw) return 60_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 60_000;

  return parsed;
}

export function getChatRateLimitMaxRequests(): number {
  const raw = process.env.PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS;
  if (!raw) return 60;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 60;

  return parsed;
}

function getChatImageMaxSizeMb(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB;
  if (!raw) return 5;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 5;

  return parsed;
}

export function getChatImageMaxSizeBytes(): number {
  return getChatImageMaxSizeMb() * 1024 * 1024;
}

const DEFAULT_CHAT_ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function getChatAllowedImageMimeTypes(): string[] {
  const env = process.env.NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES;
  if (!env) return [...DEFAULT_CHAT_ALLOWED_IMAGE_MIME_TYPES];

  return env
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

export function getChatPageSize(): number {
  const raw = process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE;
  if (!raw) return 50;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 50;

  return Math.min(parsed, 100);
}
