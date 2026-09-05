/**
 * Orígenes externos del proveedor de almacenamiento configurado.
 *
 * Este módulo es intencionalmente autocontenido: no importa otros archivos
 * del proyecto ni módulos de Node, para poder ser usado tanto desde
 * `next.config.ts` (cuyo loader no resuelve los path aliases de tsconfig)
 * como desde `src/lib/csp-helpers.ts` en el proxy, sin arrastrar
 * dependencias de Node (p. ej. `path`) a entornos donde no corresponden.
 *
 * Nota: algunas lecturas replican getters ya expuestos en
 * `src/config/storage.ts` (p. ej. el token de Vercel Blob); se duplican a
 * propósito para mantener este módulo libre de imports.
 */

/**
 * Valor crudo (recortado) de `STORAGE_PROVIDER`. Devuelve 'local' si no está
 * definido. No valida ni emite advertencias; para la versión validada usá
 * `getStorageProvider` de `@/config/videos`.
 */
function getStorageProviderName(): string {
  return (process.env.STORAGE_PROVIDER ?? 'local').trim();
}

/**
 * Token de lectura/escritura para Vercel Blob (`BLOB_READ_WRITE_TOKEN`).
 */
function getBlobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim();
}

/**
 * Origen con comodín desde el que Vercel Blob sirve los archivos públicos.
 * Formato válido para la CSP; para `next/image` se transforma a patrón de
 * `remotePatterns`.
 */
const VERCEL_BLOB_PUBLIC_ORIGIN =
  'https://*.public.blob.vercel-storage.com';

/**
 * Origen público del bucket S3 configurado: el origin de `S3_ENDPOINT` si es
 * una URL válida, o `https://<bucket>.s3.<region>.amazonaws.com` cuando hay
 * bucket (`S3_BUCKET`) y región (`S3_REGION`). Devuelve null si no se puede
 * determinar.
 */
function getS3Origin(): string | null {
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    try {
      return new URL(endpoint).origin;
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
 * Origen público del almacenamiento R2, derivado de `R2_ACCOUNT_ID`.
 * Devuelve null si no está definido.
 */
function getR2Origin(): string | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) return null;
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Orígenes externos permitidos en `img-src` de la CSP (y en
 * `images.remotePatterns` de `next.config.ts`) según el proveedor activo.
 */
export function getStorageImageOrigins(): string[] {
  const storageProvider = getStorageProviderName();
  const origins: string[] = [];

  if (storageProvider === 'vercel-blob' && getBlobReadWriteToken()) {
    origins.push(VERCEL_BLOB_PUBLIC_ORIGIN);
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

/**
 * Orígenes externos permitidos en `connect-src`/`media-src` de la CSP según
 * el proveedor de almacenamiento activo.
 */
export function getStorageRemoteOrigins(): string[] {
  const storageProvider = getStorageProviderName();
  const origins: string[] = [];

  if (storageProvider === 'vercel-blob' && getBlobReadWriteToken()) {
    origins.push('https://vercel.com');
    origins.push('https://blob.vercel-storage.com');
    origins.push(VERCEL_BLOB_PUBLIC_ORIGIN);
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
