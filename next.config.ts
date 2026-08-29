import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  // Deshabilitar compresión en test para evitar advertencias de listeners y
  // posibles conflictos entre Turbopack y los tests E2E.
  compress: process.env.NODE_ENV !== 'test',
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async headers() {
    const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim();
    const allowedImageDomains = (
      process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS ?? ''
    )
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => (d.startsWith('http://') || d.startsWith('https://') ? d : `https://${d}`));

    const imageSources = ["'self'", 'data:', 'blob:'];

    if (storageProvider === 'vercel-blob') {
      imageSources.push('https://blob.vercel-storage.com');
    }

    if (storageProvider === 's3' && process.env.S3_ENDPOINT) {
      const origin = new URL(process.env.S3_ENDPOINT).origin;
      imageSources.push(origin);
    }

    if (
      storageProvider === 'r2' &&
      process.env.R2_ACCOUNT_ID
    ) {
      imageSources.push(
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      );
    }

    imageSources.push(...allowedImageDomains);

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imageSources.join(' ')}`,
      "media-src 'self' blob:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    if (process.env.NODE_ENV === 'production') {
      cspDirectives.push('upgrade-insecure-requests');
    }

    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: cspDirectives.join('; '),
      },
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

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withAnalyzer(nextConfig);
