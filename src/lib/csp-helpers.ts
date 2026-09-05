/**
 * Helpers para construir el header Content-Security-Policy.
 *
 * El nonce se genera por request en `src/proxy.ts` y se propaga
 * a los componentes de servidor mediante el header `x-nonce`. Esto permite
 * eliminar `unsafe-inline` y `unsafe-eval` de `script-src` sin romper los
 * scripts inyectados por Next.js para el App Router.
 *
 * Los orígenes del proveedor de almacenamiento y los dominios externos de
 * imágenes se resuelven mediante getters de `src/config/` para centralizar
 * la lectura de variables de entorno.
 */

import { isProduction } from '@/config/env';
import { getProductImageAllowedExternalDomains } from '@/config/product-images';
import {
  getStorageImageOrigins,
  getStorageRemoteOrigins,
} from '@/config/storage-origins';

export function getCspHeader(nonce: string): string {
  const allowedImageDomains = getProductImageAllowedExternalDomains().map(
    (d) =>
      d.startsWith('http://') || d.startsWith('https://') ? d : `https://${d}`
  );

  const imageSources = [
    "'self'",
    'data:',
    'blob:',
    ...allowedImageDomains,
    ...getStorageImageOrigins(),
  ];

  const storageOrigins = getStorageRemoteOrigins();
  const connectSources = ["'self'", 'https://www.gstatic.com', ...storageOrigins];
  const mediaSources = ["'self'", 'blob:', ...storageOrigins];

  const production = isProduction();
  const scriptSrc = production
    ? `script-src 'self' 'nonce-${nonce}' https://www.gstatic.com https://va.vercel-scripts.com`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://www.gstatic.com https://va.vercel-scripts.com`;

  const cspDirectives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(' ')}`,
    `media-src ${mediaSources.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (production) {
    cspDirectives.push('upgrade-insecure-requests');
  }

  return cspDirectives.join('; ');
}
