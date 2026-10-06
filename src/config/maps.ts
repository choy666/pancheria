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
 * público. Incluyen siempre los orígenes de los proveedores con embed público
 * (Google y OpenStreetMap), no solo los del proveedor configurado: el admin
 * puede pegar el código "Insertar un mapa" de cualquiera de ellos y la CSP
 * debe permitir el iframe resultante. El origen de
 * `NEXT_PUBLIC_MAPS_BASE_URL` se agrega cuando existe, para que la CSP y
 * `buildMapEmbedUrl` nunca se desincronicen.
 *
 * `NEXT_PUBLIC_MAPS_PROVIDER` sigue decidiendo el proveedor para construir
 * URLs a partir de coordenadas o búsquedas (chat y mapa embebido); Waze no
 * ofrece embed público: no aporta orígenes.
 */
export function getMapsFrameOrigins(): string[] {
  const baseUrl = getMapsBaseUrl();
  const origins: string[] = [
    // Los embeds de Google Maps se sirven desde maps.google.com
    // (`output=embed`) y www.google.com (`/maps/embed`).
    'https://maps.google.com',
    'https://www.google.com',
    'https://google.com',
    'https://www.openstreetmap.org',
    'https://openstreetmap.org',
  ];

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
