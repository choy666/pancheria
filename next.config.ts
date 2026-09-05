import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

/**
 * El Content-Security-Policy se genera por request en `src/proxy.ts`
 * usando un nonce. Los orígenes de imágenes y almacenamiento se resuelven
 * en `src/lib/csp-helpers.ts` para mantener la política sincronizada.
 */

/**
 * Transforma la lista de dominios permitidos para imágenes externas en el
 * formato de `remotePatterns` que requiere `next/image`. Cada entrada puede
 * incluir o no el protocolo y, opcionalmente, un puerto. Si la variable de
 * entorno está vacía, se devuelve un arreglo vacío.
 */
function getProductImageRemotePatterns() {
  const raw = process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS ?? '';

  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
    .map((domain) => {
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
    })
    .filter((pattern): pattern is { protocol: 'http' | 'https'; hostname: string; port?: string } => pattern !== null);
}

const nextConfig: NextConfig = {
  // Deshabilitar compresión en test para evitar advertencias de listeners y
  // posibles conflictos entre Turbopack y los tests E2E.
  compress: process.env.NODE_ENV !== 'test',
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },
  images: {
    remotePatterns: getProductImageRemotePatterns(),
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
