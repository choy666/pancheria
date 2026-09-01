import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getPublicBaseUrl } from '@/lib/public-url';
import { getStorageProvider } from '@/config/videos';
import { deleteStorageFile } from '@/lib/storage';
import {
  getProductImageAllowedMimeTypes,
  getProductImageLocalStorageBasePath,
  getProductImageMaxSizeBytes,
  getProductImageAllowedExternalDomains,
  getProductImageUrlMaxLength,
} from '@/config/product-images';
import { ValidationError } from '@/domain/errors';
import type { ProductRow } from '@/domain/types';
import type { S3Client } from '@aws-sdk/client-s3';
import type { createPresignedPost } from '@aws-sdk/s3-presigned-post';

export interface ProductImageFileInfo {
  name: string;
  type: string;
  size: number;
}

export interface SavedProductImage {
  key: string;
  publicUrl: string;
  mimeType: string;
  size: number;
}

export interface ProductImageUploadInstructions {
  url: string;
  method: 'POST' | 'PUT';
  fields?: Record<string, string>;
  token?: string;
  key: string;
  publicUrl: string;
}

const SAFE_PRODUCT_IMAGE_KEY_PATTERN =
  /^product-images\/\d+\/[A-Za-z0-9_-]+(?:\.(?:jpg|jpeg|png|webp))?$/;

export function isValidProductImageKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  return SAFE_PRODUCT_IMAGE_KEY_PATTERN.test(key);
}

function resolveProductImagePath(
  key: string,
  basePath?: string
): string {
  if (!isValidProductImageKey(key)) {
    throw new ValidationError('Clave de imagen de producto inválida.');
  }

  const base = basePath ?? getProductImageLocalStorageBasePath();
  const resolved = path.resolve(
    /*turbopackIgnore: true*/ base,
    /*turbopackIgnore: true*/ key
  );
  const baseResolved = path.resolve(/*turbopackIgnore: true*/ base);

  if (!resolved.startsWith(baseResolved + path.sep)) {
    throw new ValidationError(
      'Ruta de imagen de producto fuera del directorio permitido.'
    );
  }

  return resolved;
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

function generateProductImageKey(
  productId: number,
  mimeType: string
): string {
  const extension = getExtension(mimeType);
  return `product-images/${productId}/${nanoid()}${extension}`;
}

export function validateProductImage(file: ProductImageFileInfo): void {
  const allowedTypes = getProductImageAllowedMimeTypes();
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `El tipo de imagen ${file.type} no está permitido. Tipos permitidos: ${allowedTypes.join(', ')}.`
    );
  }

  const maxBytes = getProductImageMaxSizeBytes();
  if (file.size > maxBytes) {
    throw new ValidationError(
      `La imagen supera el tamaño máximo permitido de ${maxBytes} bytes.`
    );
  }
}

export function validateProductImageUrl(url: string): void {
  const maxLength = getProductImageUrlMaxLength();
  if (url.length > maxLength) {
    throw new ValidationError(
      `La URL de la imagen no puede superar los ${maxLength} caracteres.`
    );
  }

  if (!url.startsWith('https://')) {
    throw new ValidationError(
      'La URL de la imagen debe comenzar con https://.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('La URL de la imagen no es válida.');
  }

  const protocol = parsed.protocol.replace(':', '');
  if (protocol !== 'https') {
    throw new ValidationError('La URL de la imagen debe usar el protocolo HTTPS.');
  }

  if (!parsed.hostname) {
    throw new ValidationError('La URL de la imagen no tiene un dominio válido.');
  }

  const allowedDomains = getProductImageAllowedExternalDomains();
  if (allowedDomains.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      throw new ValidationError(
        `El dominio de la URL no está permitido. Dominios permitidos: ${allowedDomains.join(', ')}.`
      );
    }
  }
}

function getProductImagePublicUrlForLocal(key: string): string {
  return `${getPublicBaseUrl()}/api/productos/imagen/${encodeURIComponent(key)}`;
}

function getProductImagePublicUrlForVercelBlob(key: string): string {
  return `https://blob.vercel-storage.com/${key}`;
}

function getProductImagePublicUrlForS3R2(kind: 's3' | 'r2', key: string): string {
  const bucket =
    process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
  const endpoint =
    process.env.S3_ENDPOINT ??
    (kind === 'r2' && process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);

  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${key}`;
  }

  const region = process.env.S3_REGION ?? 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function getProductImagePublicUrl(keyOrUrl: string): string {
  if (
    keyOrUrl.startsWith('http://') ||
    keyOrUrl.startsWith('https://')
  ) {
    return keyOrUrl;
  }

  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return getProductImagePublicUrlForLocal(keyOrUrl);
    case 'vercel-blob':
      return getProductImagePublicUrlForVercelBlob(keyOrUrl);
    case 's3':
      return getProductImagePublicUrlForS3R2('s3', keyOrUrl);
    case 'r2':
      return getProductImagePublicUrlForS3R2('r2', keyOrUrl);
    default:
      throw new ValidationError(
        `Proveedor de almacenamiento no soportado: ${String(provider)}`
      );
  }
}

export function resolveProductImage(product: ProductRow): string | null {
  if (product.imageKey) {
    return getProductImagePublicUrl(product.imageKey);
  }
  return product.imageUrl ?? null;
}

export async function prepareProductImageUpload(
  file: ProductImageFileInfo,
  productId: number
): Promise<ProductImageUploadInstructions> {
  validateProductImage(file);

  const provider = getStorageProvider();
  const key = generateProductImageKey(productId, file.type);

  switch (provider) {
    case 'local': {
      const publicUrl = getProductImagePublicUrlForLocal(key);
      return {
        url: `${getPublicBaseUrl()}/api/productos/imagen/upload`,
        method: 'POST',
        fields: { key, filename: file.name, mimeType: file.type },
        key,
        publicUrl,
      };
    }
    case 'vercel-blob': {
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) {
        throw new ValidationError(
          'Falta BLOB_READ_WRITE_TOKEN para usar el proveedor Vercel Blob.'
        );
      }

      const clientModule = await import('@vercel/blob/client');
      const clientToken =
        await clientModule.generateClientTokenFromReadWriteToken({
          token,
          pathname: key,
          allowedContentTypes: [file.type],
          maximumSizeInBytes: file.size,
        });

      return {
        url: 'https://blob.vercel-storage.com',
        method: 'POST',
        token: clientToken,
        key,
        publicUrl: '',
      };
    }
    case 's3':
      return prepareS3R2Upload('s3', file, key);
    case 'r2':
      return prepareS3R2Upload('r2', file, key);
    default:
      throw new ValidationError(
        `Proveedor de almacenamiento no soportado: ${String(provider)}`
      );
  }
}

async function prepareS3R2Upload(
  kind: 's3' | 'r2',
  file: ProductImageFileInfo,
  key: string
): Promise<ProductImageUploadInstructions> {
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
  const region =
    process.env.S3_REGION ?? process.env.R2_REGION ?? 'auto';
  const endpoint =
    process.env.S3_ENDPOINT ??
    (kind === 'r2' && process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new ValidationError(
      'Faltan credenciales de S3/R2. Configurá S3_* o R2_* según el proveedor.'
    );
  }

  let s3Client: S3Client;
  let createPresignedPostFn: typeof createPresignedPost;

  try {
    const clientModule = (await import('@aws-sdk/client-s3')) as {
      S3Client: typeof S3Client;
    };
    s3Client = new clientModule.S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const presignerModule = (await import('@aws-sdk/s3-presigned-post')) as {
      createPresignedPost: typeof createPresignedPost;
    };
    createPresignedPostFn = presignerModule.createPresignedPost;
  } catch {
    throw new ValidationError(
      'Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3 y @aws-sdk/s3-presigned-post.'
    );
  }

  const publicUrl = getProductImagePublicUrlForS3R2(kind, key);

  const { url, fields } = await createPresignedPostFn(s3Client, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 0, file.size],
      ['eq', '$Content-Type', file.type],
    ],
    Fields: { 'Content-Type': file.type },
    Expires: 600,
  });

  return {
    url,
    method: 'POST',
    fields,
    key,
    publicUrl,
  };
}

export async function saveProductImage(
  file: File,
  productId: number,
  providedKey?: string
): Promise<SavedProductImage> {
  const info: ProductImageFileInfo = {
    name: file.name,
    type: file.type,
    size: file.size,
  };

  validateProductImage(info);

  const key =
    typeof providedKey === 'string' && providedKey.trim().length > 0
      ? providedKey.trim()
      : generateProductImageKey(productId, file.type);

  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return saveProductImageLocal(file, key, info, productId);
    case 'vercel-blob':
      return saveProductImageVercelBlob(file, key, info);
    case 's3':
      return saveProductImageS3R2(file, key, info, 's3');
    case 'r2':
      return saveProductImageS3R2(file, key, info, 'r2');
    default:
      throw new ValidationError(
        `Proveedor de almacenamiento no soportado: ${String(provider)}`
      );
  }
}

async function saveProductImageLocal(
  file: File,
  key: string,
  info: ProductImageFileInfo,
  productId: number
): Promise<SavedProductImage> {
  if (!isValidProductImageKey(key)) {
    throw new ValidationError('Clave de imagen de producto inválida.');
  }

  const productIdFromKey = Number(key.split('/')[1]);
  if (Number.isNaN(productIdFromKey) || productIdFromKey !== productId) {
    throw new ValidationError(
      'La clave de imagen no corresponde al producto indicado.'
    );
  }

  const basePath = getProductImageLocalStorageBasePath();
  const filePath = resolveProductImagePath(key, basePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(
    /*turbopackIgnore: true*/ filePath,
    Buffer.from(arrayBuffer)
  );

  return {
    key,
    publicUrl: getProductImagePublicUrlForLocal(key),
    mimeType: info.type,
    size: info.size,
  };
}

async function saveProductImageVercelBlob(
  file: File,
  key: string,
  info: ProductImageFileInfo
): Promise<SavedProductImage> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new ValidationError(
      'Falta BLOB_READ_WRITE_TOKEN para Vercel Blob.'
    );
  }

  const { put } = await import('@vercel/blob');
  const blob = await put(key, file, {
    token,
    contentType: info.type,
    access: 'public',
  });

  return {
    key,
    publicUrl: blob.url,
    mimeType: info.type,
    size: info.size,
  };
}

async function saveProductImageS3R2(
  file: File,
  key: string,
  info: ProductImageFileInfo,
  kind: 's3' | 'r2'
): Promise<SavedProductImage> {
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
  const region =
    process.env.S3_REGION ?? process.env.R2_REGION ?? 'auto';
  const endpoint =
    process.env.S3_ENDPOINT ??
    (kind === 'r2' && process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);

  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new ValidationError('Faltan credenciales de S3/R2.');
  }

  let s3Client: S3Client;
  let PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;

  try {
    const clientModule = (await import('@aws-sdk/client-s3')) as {
      S3Client: typeof S3Client;
      PutObjectCommand: typeof PutObjectCommand;
    };
    s3Client = new clientModule.S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    PutObjectCommand = clientModule.PutObjectCommand;
  } catch {
    throw new ValidationError(
      'Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3.'
    );
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: info.type,
    })
  );

  return {
    key,
    publicUrl: getProductImagePublicUrlForS3R2(kind, key),
    mimeType: info.type,
    size: info.size,
  };
}

export async function readProductImage(
  key: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const provider = getStorageProvider();
  if (provider !== 'local') {
    return null;
  }

  try {
    const filePath = resolveProductImagePath(key);
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
    const extension = path.extname(key).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg';
    if (extension === '.png') mimeType = 'image/png';
    if (extension === '.webp') mimeType = 'image/webp';

    return { buffer, mimeType };
  } catch {
    return null;
  }
}

export async function deleteProductImage(key: string): Promise<void> {
  if (!key) return;

  const provider = getStorageProvider();

  if (provider === 'local') {
    try {
      const filePath = resolveProductImagePath(key);
      await fs.unlink(/*turbopackIgnore: true*/ filePath);
    } catch {
      // Ignorar errores si el archivo no existe.
    }
    return;
  }

  try {
    await deleteStorageFile(key);
  } catch {
    // Ignorar errores si el archivo no existe o falla el proveedor remoto.
  }
}
