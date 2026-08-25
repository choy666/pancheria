import { logger } from './logger';

/**
 * Resuelve la URL pública base de la aplicación.
 *
 * Orden de resolución:
 * 1. `NEXT_PUBLIC_APP_URL` (disponible en cliente y servidor).
 * 2. `NEXTAUTH_URL` (solo servidor; no se expone al navegador).
 * 3. `HOST` + `PORT` (desarrollo/test; por ejemplo `localhost:3000`).
 *
 * En producción no hay fallback hardcodeado: si faltan todas las variables,
 * se lanza un error para evitar URLs rotas en Vercel. En desarrollo/test el
 * fallback final es `http://localhost:3000`, configurable con `HOST` y `PORT`.
 */
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

  if (process.env.NODE_ENV === 'production') {
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
