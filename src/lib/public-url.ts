import { logger } from './logger';

/**
 * Resuelve la URL pública base de la aplicación.
 *
 * En el servidor puede usar `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL`.
 * En el cliente solo está disponible `NEXT_PUBLIC_APP_URL` (las variables
 * sin prefijo NEXT_PUBLIC_ no se exponen al navegador).
 *
 * Si no hay ninguna variable configurada, usa `http://localhost:3000` como
 * fallback. En producción emite una advertencia para evitar URLs rotas en
 * Vercel.
 */
export function getPublicBaseUrl(): string {
  const isBrowser = typeof window !== 'undefined';

  const envUrl = isBrowser
    ? process.env.NEXT_PUBLIC_APP_URL
    : (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL);

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const fallback = 'http://localhost:3000';

  if (process.env.NODE_ENV === 'production') {
    const missing = isBrowser
      ? 'NEXT_PUBLIC_APP_URL'
      : 'NEXT_PUBLIC_APP_URL ni NEXTAUTH_URL';

    logger.warn(
      `No se configuró ${missing}. Las URLs públicas caerán en el fallback ${fallback}.`,
      { source: 'getPublicBaseUrl', browser: isBrowser }
    );
  }

  return fallback;
}
