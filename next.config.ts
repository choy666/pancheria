import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';
// Los imports a src/ se hacen con rutas relativas porque el loader de
// next.config.ts no resuelve los path aliases de tsconfig. El módulo
// `storage-origins` es autocontenido (sin imports) a propósito.
import { getStorageImageOrigins } from './src/config/storage-origins';
import { getProductImageAllowedExternalDomains } from './src/config/product-images';

/**
 * El Content-Security-Policy se genera por request en `src/proxy.ts`
 * usando un nonce. Los orígenes de imágenes y almacenamiento se resuelven
 * en `src/lib/csp-helpers.ts` y `src/config/storage-origins.ts` para
 * mantener la política sincronizada.
 */

/**
 * Transforma un dominio u origen (con o sin protocolo, y opcionalmente con
 * puerto o comodín `*`) en el formato de `remotePatterns` que requiere
 * `next/image`. Devuelve null si la entrada no contiene un hostname válido.
 */
function domainToRemotePattern(domain: string) {
  let protocol: 'http' | 'https' = 'https';
  let host = domain;

  if (host.includes('://')) {
    const [scheme, rest] = host.split('://', 2);
    if (scheme === 'http' || scheme === 'https') {
      protocol = scheme;
    }
    host = rest ?? '';
  }

  // Se ignora cualquier ruta o query que pueda haber quedado.
  const hostPort = host.split('/')[0].split('?')[0].split('#')[0];
  if (!hostPort) return null;

  let hostname = hostPort;
  let port: string | undefined;
  const portMatch = hostname.match(/^(.+):(\d+)$/);
  if (portMatch) {
    hostname = portMatch[1] ?? '';
    port = portMatch[2];
  }

  if (!hostname) return null;

  return port
    ? { protocol, hostname, port }
    : { protocol, hostname };
}

/**
 * Construye la lista de `remotePatterns` para `next/image`: los dominios
 * permitidos por `PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS` más el origen del
 * proveedor de almacenamiento configurado (`vercel-blob`, `s3` o `r2`),
 * compartido con la CSP para mantener ambas políticas sincronizadas.
 */
function getImageRemotePatterns() {
  const domains = [
    ...getProductImageAllowedExternalDomains(),
    ...getStorageImageOrigins(),
  ];

  return domains
    .map(domainToRemotePattern)
    .filter(
      (pattern): pattern is { protocol: 'http' | 'https'; hostname: string; port?: string } =>
        pattern !== null
    );
}

/**
 * Validación build-time de variables críticas. Solo corre en builds de
 * producción reales de Vercel (`VERCEL_ENV=production` y `CI=1`, que Vercel
 * inyecta en tiempo de build) para no romper `npm run build` locales —el
 * `.env.local` del proyecto replica `VERCEL_ENV=production`— ni el job de
 * CI de GitHub, que no recibe estas variables.
 * Fallar el build evita deploys que luego fallan en runtime de forma
 * silenciosa (cron sin secreto, auth sin URL, storage efímero).
 */
function assertVercelProductionEnv() {
  const isVercelProductionBuild =
    process.env.VERCEL_ENV === 'production' &&
    !!process.env.CI &&
    process.env.CI !== '0' &&
    process.env.CI !== 'false';
  if (!isVercelProductionBuild) return;

  const missing: string[] = [];
  if (!process.env.CRON_SECRET) missing.push('CRON_SECRET');
  if (!process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
    missing.push('NEXTAUTH_URL o AUTH_URL');
  }
  if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    missing.push('NEXTAUTH_SECRET o AUTH_SECRET');
  }
  if (
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_URL &&
    !process.env.POSTGRES_PRISMA_URL
  ) {
    missing.push('DATABASE_URL (o POSTGRES_URL/POSTGRES_PRISMA_URL)');
  }

  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim();
  if (storageProvider === 'local') {
    missing.push(
      'STORAGE_PROVIDER distinto de local (el filesystem de Vercel es efímero; usar vercel-blob, s3 o r2)'
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables críticas para producción en Vercel: ${missing.join(', ')}. ` +
        'Configuralas en Project Settings → Environment Variables → Production.'
    );
  }
}

assertVercelProductionEnv();

const nextConfig: NextConfig = {
  // Deshabilitar compresión en test para evitar advertencias de listeners y
  // posibles conflictos entre Turbopack y los tests E2E.
  compress: process.env.NODE_ENV !== 'test',
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },
  images: {
    remotePatterns: getImageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    // Marca interna del servidor E2E: `npm run dev:e2e` define
    // E2E_SERVER_MARKER=e2e y `tests/e2e/global-setup.ts` exige este header
    // para no correr los tests contra un servidor ajeno que Playwright haya
    // reutilizado por `reuseExistingServer` (p. ej. un `npm run dev` con
    // `.env.local` sirviendo otra base de datos).
    if (process.env.E2E_SERVER_MARKER === 'e2e') {
      securityHeaders.push({ key: 'x-e2e-server', value: 'e2e' });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/recetas/:productId/editar',
        destination: '/productos/:productId/editar',
        permanent: true,
      },
    ];
  },
};

/**
 * Nota: el bundle analyzer de Next.js no genera el reporte HTML bajo
 * Turbopack. Para obtener el análisis completo hay que correr
 * `ANALYZE=true next build --webpack` o forzar webpack.
 */
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withAnalyzer(nextConfig);
