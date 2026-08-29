import path from 'path';

const DEFAULT_PRODUCT_IMAGE_MAX_SIZE_MB = 5;

const DEFAULT_PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const DEFAULT_PRODUCT_IMAGE_URL_MAX_LENGTH = 2048;

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

export function getProductImageUrlMaxLength(): number {
  const raw =
    process.env.NEXT_PUBLIC_PRODUCT_IMAGE_URL_MAX_LENGTH ??
    process.env.PRODUCT_IMAGE_URL_MAX_LENGTH;
  if (!raw) return DEFAULT_PRODUCT_IMAGE_URL_MAX_LENGTH;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PRODUCT_IMAGE_URL_MAX_LENGTH;
  }

  return parsed;
}
