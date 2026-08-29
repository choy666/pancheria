import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

/**
 * Resuelve el origen de S3 a partir de las variables de entorno.
 * Si S3_ENDPOINT está definido, lo usa; si no, construye el origen
 * estándar de AWS S3 a partir del bucket y la región.
 */
function getS3Origin(): string | null {
  if (process.env.S3_ENDPOINT) {
    try {
      return new URL(process.env.S3_ENDPOINT).origin;
    } catch {
      return null;
    }
  }

  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  return null;
}

/**
 * Resuelve el origen de Cloudflare R2 a partir de R2_ACCOUNT_ID.
 */
function getR2Origin(): string | null {
  if (!process.env.R2_ACCOUNT_ID) return null;
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

/**
 * Devuelve los orígenes que deben permitirse en connect-src y media-src
 * según el proveedor de almacenamiento configurado. Esto evita que el
 * navegador bloquee la subida o reproducción de videos y adjuntos.
 */
function getStorageOrigins(): string[] {
  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim();
  const origins: string[] = [];

  if (storageProvider === 'vercel-blob' && process.env.BLOB_READ_WRITE_TOKEN) {
    // El SDK de Vercel Blob client puede conectar a https://vercel.com/api/blob
    // durante la negociación del token, y luego a https://blob.vercel-storage.com
    // para la subida. Los recursos públicos se sirven desde *.public.blob.vercel-storage.com.
    origins.push('https://vercel.com');
    origins.push('https://blob.vercel-storage.com');
    origins.push('https://*.public.blob.vercel-storage.com');
  }

  if (storageProvider === 's3') {
    const origin = getS3Origin();
    if (origin) origins.push(origin);
  }

  if (storageProvider === 'r2') {
    const origin = getR2Origin();
    if (origin) origins.push(origin);
  }

  return origins;
}

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

    if (storageProvider === 'vercel-blob' && process.env.BLOB_READ_WRITE_TOKEN) {
      imageSources.push('https://*.public.blob.vercel-storage.com');
    }

    if (storageProvider === 's3') {
      const origin = getS3Origin();
      if (origin) imageSources.push(origin);
    }

    if (
      storageProvider === 'r2' &&
      process.env.R2_ACCOUNT_ID
    ) {
      const origin = getR2Origin();
      if (origin) imageSources.push(origin);
    }

    imageSources.push(...allowedImageDomains);

    const storageOrigins = getStorageOrigins();
    const connectSources = ["'self'", 'https://www.gstatic.com', ...storageOrigins];
    const mediaSources = ["'self'", 'blob:', ...storageOrigins];

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://va.vercel-scripts.com",
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
