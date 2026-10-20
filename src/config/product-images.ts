import path from 'path';

const DEFAULT_PRODUCT_IMAGE_MAX_SIZE_MB = 5;

// Normalización en el navegador antes de subir: toda imagen de producto se
// publica en un lienzo fijo 16:9. El archivo original puede ser mucho más
// grande que el límite de subida porque se comprime antes de enviarlo.
export const PRODUCT_IMAGE_TARGET_WIDTH = 1200;
export const PRODUCT_IMAGE_TARGET_HEIGHT = 675;
export const PRODUCT_IMAGE_WEBP_QUALITY = 0.8;
export const PRODUCT_IMAGE_JPEG_QUALITY = 0.85;
export const PRODUCT_IMAGE_INPUT_MAX_BYTES = 30 * 1024 * 1024;
// Si el lado mayor del original queda por debajo, se avisa que la imagen
// puede verse borrosa al estirarse hasta el tamaño de publicación.
export const PRODUCT_IMAGE_MIN_SOURCE_LONG_EDGE_PX = 800;
// Fondo del lienzo publicado: blanco opaco. Todas las imágenes comparten el
// mismo escenario neutro (la alternativa transparente dejaba ver el fondo de
// cada card, que varía entre contextos, y generaba un look inconsistente).
export const PRODUCT_IMAGE_BACKGROUND = '#ffffff';

const DEFAULT_PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

function getProductImageMaxSizeMb(): number {
  const raw = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB;
  if (!raw) return DEFAULT_PRODUCT_IMAGE_MAX_SIZE_MB;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PRODUCT_IMAGE_MAX_SIZE_MB;
  }

  return parsed;
}

export function getProductImageMaxSizeBytes(): number {
  return getProductImageMaxSizeMb() * 1024 * 1024;
}

export function getProductImageAllowedMimeTypes(): string[] {
  const raw = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_ALLOWED_MIME_TYPES;
  if (!raw) return [...DEFAULT_PRODUCT_IMAGE_ALLOWED_MIME_TYPES];

  return raw
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

export function getProductImageLocalStorageBasePath(): string {
  const envPath =
    process.env.PRODUCT_IMAGE_LOCAL_STORAGE_PATH ??
    process.env.LOCAL_STORAGE_PATH;

  if (envPath) {
    return path.resolve(envPath);
  }

  return path.join(process.cwd(), 'tmp', 'videos', 'product-images');
}

export function getProductImageAllowedExternalDomains(): string[] {
  const raw = process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS;
  if (!raw) return [];

  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}
