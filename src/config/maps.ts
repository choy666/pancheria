/**
 * Configuración del proveedor de mapas. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export type MapProvider = 'openstreetmap' | 'google' | 'waze' | 'raw';

export function getMapsProvider(): MapProvider {
  const env = process.env.NEXT_PUBLIC_MAPS_PROVIDER;
  if (
    env === 'openstreetmap' ||
    env === 'google' ||
    env === 'waze' ||
    env === 'raw'
  ) {
    return env;
  }
  return 'openstreetmap';
}

export function getMapsBaseUrl(): string | undefined {
  const env = process.env.NEXT_PUBLIC_MAPS_BASE_URL;
  if (!env) return undefined;
  const trimmed = env.trim().replace(/\/$/, '');
  return trimmed || undefined;
}
