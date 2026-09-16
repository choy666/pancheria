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
