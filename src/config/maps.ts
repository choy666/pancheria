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

/**
 * Orígenes https permitidos en `frame-src` para el mapa embebido del catálogo
 * público. Se derivan del proveedor configurado (`NEXT_PUBLIC_MAPS_PROVIDER`)
 * y del origen de `NEXT_PUBLIC_MAPS_BASE_URL` cuando existe, para que la CSP
 * y `buildMapEmbedUrl` nunca se desincronicen.
 *
 * Waze no ofrece embed público: no aporta orígenes.
 */
export function getMapsFrameOrigins(): string[] {
  const provider = getMapsProvider();
  const baseUrl = getMapsBaseUrl();
  const origins: string[] = [];

  if (provider === 'google') {
    // Los embeds de Google Maps se sirven desde maps.google.com
    // (`output=embed`) y www.google.com (`/maps/embed`).
    origins.push(
      'https://maps.google.com',
      'https://www.google.com',
      'https://google.com'
    );
  } else if (provider === 'openstreetmap' || (provider === 'raw' && !baseUrl)) {
    // `raw` usa la plantilla de OpenStreetMap cuando no hay URL base
    // personalizada.
    origins.push(
      'https://www.openstreetmap.org',
      'https://openstreetmap.org'
    );
  }

  if (baseUrl) {
    try {
      const origin = new URL(baseUrl).origin;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      // Una URL base inválida se ignora igual que en el resto de helpers.
    }
  }

  return origins;
}
