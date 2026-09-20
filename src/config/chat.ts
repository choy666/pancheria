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

export function getChatBranchLocationRateLimitWindowMs(): number {
  const raw = process.env.CHAT_BRANCH_LOCATION_RATE_LIMIT_WINDOW_MS;
  if (!raw) return 60_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 60_000;

  return parsed;
}

export function getChatBranchLocationRateLimitMaxRequests(): number {
  const raw = process.env.CHAT_BRANCH_LOCATION_RATE_LIMIT_MAX_REQUESTS;
  if (!raw) return 5;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 5;

  return parsed;
}

/**
 * Si `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`, los chats abiertos intentan
 * consumir mensajes por SSE (`.../chat/stream`) en lugar del polling de
 * `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`. Ante cualquier falla del stream el
 * cliente vuelve automáticamente al polling (fallback garantizado).
 */
export function getChatStreamEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHAT_STREAM_ENABLED === 'true';
}

/**
 * Intervalo del poll interno que el endpoint SSE hace contra la base para
 * detectar mensajes nuevos (solo servidor). No es el poll del cliente.
 */
export function getChatStreamIntervalMs(): number {
  const raw = process.env.CHAT_STREAM_INTERVAL_MS;
  if (!raw) return 2_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 500) return 2_000;

  return Math.min(parsed, 60_000);
}

/**
 * Intervalo del comentario heartbeat (`: heartbeat`) que mantiene viva la
 * conexión SSE atravesando proxies (solo servidor).
 */
export function getChatStreamHeartbeatMs(): number {
  const raw = process.env.CHAT_STREAM_HEARTBEAT_MS;
  if (!raw) return 15_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 15_000;

  return parsed;
}

/**
 * Presupuesto máximo de una conexión SSE en milisegundos (solo servidor). El
 * stream se cierra al alcanzarlo — antes de `maxDuration` de la función — y el
 * cliente reconecta con `Last-Event-ID`. Acota la facturación por duración en
 * serverless. También es el tope del parámetro `budget` de la query.
 */
export function getChatStreamBudgetMs(): number {
  const raw = process.env.CHAT_STREAM_BUDGET_MS;
  if (!raw) return 55_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 55_000;

  return Math.min(parsed, 280_000);
}

/**
 * Días de retención de mensajes de pedidos en estado terminal
 * (`finished`/`cancelled`). `null` = sin purga (default: se conserva el
 * historial completo como auditoría). Se aplica en el cron
 * `chat-attachments-cleanup`.
 */
export function getOrderMessagesRetentionDays(): number | null {
  const raw = process.env.ORDER_MESSAGES_RETENTION_DAYS;
  if (!raw) return null;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return null;

  return parsed;
}
