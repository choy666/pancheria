/**
 * Configuración de red. URLs y timeouts leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

import { isProduction } from './env';
import { logger } from '@/lib/logger';

function resolveBaseUrl(isBrowser: boolean): string {
  const envUrl = isBrowser
    ? process.env.NEXT_PUBLIC_APP_URL
    : (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL);

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const host = process.env.HOST;
  const port = process.env.PORT;

  if (host || port) {
    const safePort = port || '3000';
    return `http://${host || 'localhost'}:${safePort}`;
  }

  if (isProduction()) {
    const missing = isBrowser
      ? 'NEXT_PUBLIC_APP_URL'
      : 'NEXT_PUBLIC_APP_URL o NEXTAUTH_URL';

    throw new Error(
      `No se configuró ${missing}. Las URLs públicas en producción requieren una URL base válida.`
    );
  }

  const fallback = 'http://localhost:3000';
  const missing = isBrowser
    ? 'NEXT_PUBLIC_APP_URL'
    : 'NEXT_PUBLIC_APP_URL o NEXTAUTH_URL';

  logger.warn(
    `No se configuró ${missing}. Las URLs públicas usarán el fallback de desarrollo ${fallback}. Configurá HOST y PORT para evitar este valor hardcodeado.`,
    { source: 'getPublicBaseUrl', browser: isBrowser }
  );

  return fallback;
}

export function getPublicBaseUrl(): string {
  const isBrowser = typeof window !== 'undefined';
  return resolveBaseUrl(isBrowser);
}

export function getApiTimeoutMs(): number {
  const env = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
  if (!env) return 30_000;

  const parsed = Number(env);
  if (Number.isNaN(parsed) || parsed <= 0) return 30_000;

  return parsed;
}
