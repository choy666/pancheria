/**
 * Helpers para construir el header Content-Security-Policy.
 *
 * El nonce se genera por request en `src/middleware.ts` y se propaga
 * a los componentes de servidor mediante el header `x-nonce`. Esto permite
 * eliminar `unsafe-inline` y `unsafe-eval` de `script-src` sin romper los
 * scripts inyectados por Next.js para el App Router.
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

function getR2Origin(): string | null {
  if (!process.env.R2_ACCOUNT_ID) return null;
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function getStorageOrigins(): string[] {
  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim();
  const origins: string[] = [];

  if (storageProvider === 'vercel-blob' && process.env.BLOB_READ_WRITE_TOKEN) {
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

export function getCspHeader(nonce: string): string {
  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim();

  const allowedImageDomains = (
    process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS ?? ''
  )
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) =>
      d.startsWith('http://') || d.startsWith('https://') ? d : `https://${d}`
    );

  const imageSources = ["'self'", 'data:', 'blob:', ...allowedImageDomains];

  if (storageProvider === 'vercel-blob' && process.env.BLOB_READ_WRITE_TOKEN) {
    imageSources.push('https://*.public.blob.vercel-storage.com');
  }

  if (storageProvider === 's3') {
    const origin = getS3Origin();
    if (origin) imageSources.push(origin);
  }

  if (storageProvider === 'r2' && process.env.R2_ACCOUNT_ID) {
    const origin = getR2Origin();
    if (origin) imageSources.push(origin);
  }

  const storageOrigins = getStorageOrigins();
  const connectSources = ["'self'", 'https://www.gstatic.com', ...storageOrigins];
  const mediaSources = ["'self'", 'blob:', ...storageOrigins];

  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
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

  if (process.env.NODE_ENV === 'production') {
    cspDirectives.push('upgrade-insecure-requests');
  }

  return cspDirectives.join('; ');
}
