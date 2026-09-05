import path from 'path';
import { getProductImageLocalStorageBasePath as getProductImageLocalStorageBasePathFromConfig } from '@/config/product-images';

/**
 * Configuración centralizada para los proveedores de almacenamiento.
 * No debe acceder a la base de datos ni generar side effects.
 */

/**
 * Ruta base para almacenamiento local de videos y adjuntos.
 */
export function getLocalStorageBasePath(): string {
  return (
    process.env.LOCAL_STORAGE_PATH ??
    path.join(process.cwd(), 'tmp', 'videos')
  );
}

/**
 * Ruta base para almacenamiento local de adjuntos de chat.
 * Si no se configura una específica, usa la ruta local general.
 */
export function getChatLocalStorageBasePath(): string {
  return (
    process.env.CHAT_LOCAL_STORAGE_PATH ??
    process.env.LOCAL_STORAGE_PATH ??
    path.join(process.cwd(), 'tmp', 'videos')
  );
}

/**
 * Ruta base para almacenamiento local de imágenes de productos.
 * Se re-exporta desde la configuración específica de productos para
 * respetar su comportamiento actual sin duplicar la lógica.
 */
export function getProductImageLocalStorageBasePath(): string {
  return getProductImageLocalStorageBasePathFromConfig();
}

/**
 * Token de lectura/escritura para Vercel Blob.
 */
export function getBlobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim();
}

/**
 * Clave de acceso para S3 o R2.
 */
function getS3R2AccessKeyId(): string | undefined {
  return process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
}

/**
 * Clave secreta para S3 o R2.
 */
function getS3R2SecretAccessKey(): string | undefined {
  return process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
}

/**
 * Nombre del bucket para S3 o R2.
 */
export function getS3R2Bucket(): string | undefined {
  return process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
}

/**
 * Región para S3 o R2, usada en la configuración del cliente.
 */
function getS3R2Region(): string {
  return process.env.S3_REGION ?? process.env.R2_REGION ?? 'auto';
}

/**
 * Región para construir URLs públicas de S3.
 * Solo considera S3_REGION, con us-east-1 como fallback.
 */
export function getS3PublicUrlRegion(): string {
  return process.env.S3_REGION ?? 'us-east-1';
}

/**
 * Endpoint personalizado para S3 o R2.
 * Para R2, si no hay S3_ENDPOINT pero existe R2_ACCOUNT_ID,
 * se construye el endpoint de Cloudflare R2.
 */
export function getS3R2Endpoint(kind: 's3' | 'r2'): string | undefined {
  return (
    process.env.S3_ENDPOINT ??
    (kind === 'r2' && process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined)
  );
}

/**
 * Credenciales completas para S3 o R2.
 * Devuelve null si falta algún valor obligatorio.
 */
export function getS3R2Credentials(
  kind: 's3' | 'r2'
): {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  endpoint?: string;
} | null {
  const accessKeyId = getS3R2AccessKeyId();
  const secretAccessKey = getS3R2SecretAccessKey();
  const bucket = getS3R2Bucket();

  if (!accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    region: getS3R2Region(),
    endpoint: getS3R2Endpoint(kind),
  };
}
