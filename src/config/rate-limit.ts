/**
 * Configuración de rate limiting. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getRateLimitStoreProvider(): 'memory' | 'db' | undefined {
  const provider = process.env.RATE_LIMIT_STORE_PROVIDER;
  if (provider === 'memory' || provider === 'db') return provider;
  return undefined;
}

export function getPublicOrderRateLimitStoreProvider(): 'memory' | 'db' | undefined {
  const provider = process.env.PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER;
  if (provider === 'memory' || provider === 'db') return provider;
  return undefined;
}

export function getE2eEnableRateLimit(): boolean {
  return process.env.E2E_ENABLE_RATE_LIMIT === 'true';
}

export function getPublicOrderRateLimitEnableInDev(): boolean {
  return process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV === 'true';
}

export function getPublicRateLimitTrustPrivateIps(): boolean {
  return process.env.PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS === 'true';
}

const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Cantidad máxima de intentos fallidos de login antes del bloqueo temporal
 * (`LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, por defecto 5).
 */
export function getLoginRateLimitMaxAttempts(): number {
  const raw = process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  if (!raw) return DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  }
  return Math.floor(parsed);
}

/**
 * Ventana del rate limit de login en milisegundos
 * (`LOGIN_RATE_LIMIT_WINDOW_MS`, por defecto 15 minutos).
 */
export function getLoginRateLimitWindowMs(): number {
  const raw = process.env.LOGIN_RATE_LIMIT_WINDOW_MS;
  if (!raw) return DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS;
  }
  return parsed;
}

const DEFAULT_LOGIN_ATTEMPTS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Retención de `login_attempts` en milisegundos
 * (`LOGIN_ATTEMPTS_RETENTION_MS`, por defecto 7 días). El cron
 * `rate-limit-cleanup` borra los intentos cuyo `last_attempt` supere el
 * período para acotar el crecimiento de la tabla.
 */
export function getLoginAttemptsRetentionMs(): number {
  const raw = process.env.LOGIN_ATTEMPTS_RETENTION_MS;
  if (!raw) return DEFAULT_LOGIN_ATTEMPTS_RETENTION_MS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LOGIN_ATTEMPTS_RETENTION_MS;
  }
  return parsed;
}

const DEFAULT_PUBLIC_POLL_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS = 240;

/**
 * Ventana del rate limit de polls GET públicos en milisegundos
 * (`PUBLIC_POLL_RATE_LIMIT_WINDOW_MS`, por defecto 60000). Es un veto
 * anti-abuso generoso aplicado en memoria por instancia, no un límite de
 * negocio: los defaults toleran el poll de 5 s del chat con margen.
 */
export function getPublicPollRateLimitWindowMs(): number {
  const raw = process.env.PUBLIC_POLL_RATE_LIMIT_WINDOW_MS;
  if (!raw) return DEFAULT_PUBLIC_POLL_RATE_LIMIT_WINDOW_MS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) {
    return DEFAULT_PUBLIC_POLL_RATE_LIMIT_WINDOW_MS;
  }
  return parsed;
}

/**
 * Cantidad máxima de requests de polls GET públicos por IP en la ventana
 * (`PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS`, por defecto 240).
 */
export function getPublicPollRateLimitMaxRequests(): number {
  const raw = process.env.PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS;
  if (!raw) return DEFAULT_PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS;
  }
  return parsed;
}
