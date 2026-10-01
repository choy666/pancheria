import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getPublicBaseUrl } from '@/lib/public-url';
import { getStorageProvider } from '@/config/videos';
import {
  assertBufferSignature,
  assertFileSignature,
  deleteStorageFile,
  SIGNATURE_READ_BYTES,
} from '@/lib/storage';
import {
  getBlobReadWriteToken,
  getProductImageLocalStorageBasePath,
  getS3R2Bucket,
  getS3R2Credentials,
  getS3R2Endpoint,
  getS3PublicUrlRegion,
} from '@/config/storage';
import {
  getProductImageAllowedMimeTypes,
  getProductImageMaxSizeBytes,
  getProductImageAllowedExternalDomains,
  getProductImageUrlMaxLength,
} from '@/config/product-images';
import { getStorageImageOrigins } from '@/config/storage-origins';
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

function getProductImagePublicUrlForLocal(
  key: string,
  branchId: number
): string {
  // El branchId viaja en la URL porque el servido local valida la clave
  // contra la sucursal del producto (GET /api/productos/imagen/[key]).
  return `${getPublicBaseUrl()}/api/productos/imagen/${encodeURIComponent(key)}?branchId=${branchId}`;
}

function getProductImagePublicUrlForVercelBlob(key: string): string {
  return `https://blob.vercel-storage.com/${key}`;
}

function getProductImagePublicUrlForS3R2(kind: 's3' | 'r2', key: string): string {
  const bucket = getS3R2Bucket();
  const endpoint = getS3R2Endpoint(kind);

  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${key}`;
  }

  const region = getS3PublicUrlRegion();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function getProductImagePublicUrl(
  keyOrUrl: string,
  branchId: number
): string {
  if (
    keyOrUrl.startsWith('http://') ||
    keyOrUrl.startsWith('https://')
  ) {
    return keyOrUrl;
  }

  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return getProductImagePublicUrlForLocal(keyOrUrl, branchId);
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

/**
 * Indica si `host` matchea un patrón de origen permitido para imágenes:
 * dominio plano ('ejemplo.com'), comodín ('*.ejemplo.com') o URL completa.
 */
function matchesImageHostPattern(host: string, pattern: string): boolean {
  const normalized = pattern
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === normalized;
}

/**
 * next/image solo sirve hosts listados en `remotePatterns` (dominios
 * externos permitidos + orígenes del provider de storage). Una URL
 * persistida fuera de esa lista lanza en render y deja el catálogo entero
 * sin contenido: se omite la imagen y la card muestra el ícono de fallback.
 */
function isRenderableImageHost(host: string): boolean {
  const allowed = [
    ...getProductImageAllowedExternalDomains(),
    ...getStorageImageOrigins(),
  ];
  return allowed.some((pattern) => matchesImageHostPattern(host, pattern));
}

export function resolveProductImage(product: ProductRow): string | null {
  let candidate: string | null;

  if (!product.imageKey) {
    candidate = product.imageUrl ?? null;
  } else {
    const provider = getStorageProvider();

    // La URL pública real de Vercel Blob incluye el subdominio del store
    // (<storeId>.public.blob.vercel-storage.com) y no se puede reconstruir
    // desde la key: la devuelve el upload y queda persistida en image_url.
    if (provider === 'vercel-blob') {
      candidate = product.imageUrl ?? null;
    } else if (provider === 'local') {
      // El endpoint local es same-origin: se devuelve la ruta relativa para
      // que next/image la acepte sin remotePatterns y sin depender de la URL
      // base vigente al momento de persistir.
      candidate = `/api/productos/imagen/${encodeURIComponent(product.imageKey)}?branchId=${product.branchId}`;
    } else {
      candidate = getProductImagePublicUrl(product.imageKey, product.branchId);
    }
  }

  if (!candidate) return null;

  // Las rutas relativas se sirven same-origin y no necesitan remotePatterns.
  if (candidate.startsWith('/')) return candidate;

  try {
    if (!isRenderableImageHost(new URL(candidate).hostname)) {
      return null;
    }
  } catch {
    return null;
  }

  return candidate;
}

export async function prepareProductImageUpload(
  file: ProductImageFileInfo,
  productId: number,
  branchId: number
): Promise<ProductImageUploadInstructions> {
  validateProductImage(file);

  const provider = getStorageProvider();
  const key = generateProductImageKey(productId, file.type);

  switch (provider) {
    case 'local': {
      const publicUrl = getProductImagePublicUrlForLocal(key, branchId);
      return {
        url: `${getPublicBaseUrl()}/api/productos/imagen/upload`,
        method: 'POST',
        fields: { key, filename: file.name, mimeType: file.type },
        key,
        publicUrl,
      };
    }
    case 'vercel-blob': {
      const token = getBlobReadWriteToken();
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
  const credentials = getS3R2Credentials(kind);

  if (!credentials) {
    throw new ValidationError(
      'Faltan credenciales de S3/R2. Configurá S3_* o R2_* según el proveedor.'
    );
  }

  const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
    credentials;

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
  providedKey: string | undefined,
  branchId: number
): Promise<SavedProductImage> {
  const info: ProductImageFileInfo = {
    name: file.name,
    type: file.type,
    size: file.size,
  };

  validateProductImage(info);

  // Verificar los magic bytes: el Content-Type declarado no es confiable.
  // Esto cubre los tres proveedores porque todos reciben el File real.
  await assertFileSignature(file, info.type);

  const key =
    typeof providedKey === 'string' && providedKey.trim().length > 0
      ? providedKey.trim()
      : generateProductImageKey(productId, file.type);

  const provider = getStorageProvider();

  switch (provider) {
    case 'local':
      return saveProductImageLocal(file, key, info, productId, branchId);
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
  productId: number,
  branchId: number
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
    publicUrl: getProductImagePublicUrlForLocal(key, branchId),
    mimeType: info.type,
    size: info.size,
  };
}

async function saveProductImageVercelBlob(
  file: File,
  key: string,
  info: ProductImageFileInfo
): Promise<SavedProductImage> {
  const token = getBlobReadWriteToken();
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
  const credentials = getS3R2Credentials(kind);

  if (!credentials) {
    throw new ValidationError('Faltan credenciales de S3/R2.');
  }

  const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
    credentials;

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

async function readStreamHeader(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < SIGNATURE_READ_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value || value.length === 0) break;
      chunks.push(value);
      total += value.length;
    }
    const header = new Uint8Array(Math.min(total, SIGNATURE_READ_BYTES));
    let offset = 0;
    for (const chunk of chunks) {
      const remaining = header.length - offset;
      if (remaining <= 0) break;
      header.set(chunk.subarray(0, remaining), offset);
      offset += Math.min(chunk.length, remaining);
    }
    return header;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function readS3R2ObjectHeader(
  kind: 's3' | 'r2',
  key: string
): Promise<Uint8Array> {
  const credentials = getS3R2Credentials(kind);
  if (!credentials) {
    throw new ValidationError('Faltan credenciales de S3/R2.');
  }

  const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
    credentials;

  let s3Client: S3Client;
  let GetObjectCommand: typeof import('@aws-sdk/client-s3').GetObjectCommand;

  try {
    const clientModule = (await import('@aws-sdk/client-s3')) as {
      S3Client: typeof S3Client;
      GetObjectCommand: typeof GetObjectCommand;
    };
    s3Client = new clientModule.S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    GetObjectCommand = clientModule.GetObjectCommand;
  } catch {
    throw new ValidationError(
      'Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3.'
    );
  }

  let response;
  try {
    response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=0-${SIGNATURE_READ_BYTES - 1}`,
      })
    );
  } catch {
    throw new ValidationError(
      'No se encontró la imagen subida en el almacenamiento remoto.'
    );
  }

  if (!response.Body) {
    throw new ValidationError(
      'No se encontró la imagen subida en el almacenamiento remoto.'
    );
  }

  return response.Body.transformToByteArray();
}

/**
 * Verifica server-side una imagen ya subida al proveedor y devuelve su URL
 * pública canónica. Con providers remotos el archivo viaja directo al
 * proveedor (client token / presigned post) sin pasar por el servidor, así
 * que la firma de contenido se valida acá, antes de persistir la key.
 * También evita persistir claves ajenas/inexistentes y URLs suplantadas: la
 * URL guardada siempre es la que resuelve el servidor, no la del cliente.
 */
export async function verifyUploadedProductImage(
  key: string,
  mimeType: string | null | undefined,
  productId: number,
  branchId: number
): Promise<string> {
  if (!isValidProductImageKey(key)) {
    throw new ValidationError('Clave de imagen de producto inválida.');
  }

  const keyProductId = Number(key.split('/')[1]);
  if (Number.isNaN(keyProductId) || keyProductId !== productId) {
    throw new ValidationError(
      'La clave de imagen no corresponde al producto indicado.'
    );
  }

  if (!mimeType || !getProductImageAllowedMimeTypes().includes(mimeType)) {
    throw new ValidationError('Tipo de imagen no permitido.');
  }

  const provider = getStorageProvider();

  if (provider === 'local') {
    // El upload local ya verificó la firma; acá basta confirmar que el
    // archivo existe para no persistir una clave fantasma.
    const filePath = resolveProductImagePath(key);
    try {
      await fs.stat(/*turbopackIgnore: true*/ filePath);
    } catch {
      throw new ValidationError('No se encontró la imagen subida.');
    }
    return getProductImagePublicUrlForLocal(key, branchId);
  }

  if (provider === 'vercel-blob') {
    const token = getBlobReadWriteToken();
    if (!token) {
      throw new ValidationError(
        'Falta BLOB_READ_WRITE_TOKEN para usar el proveedor Vercel Blob.'
      );
    }

    const { get } = await import('@vercel/blob');
    let result;
    try {
      result = await get(key, { access: 'public', token });
    } catch {
      result = null;
    }
    if (!result || result.statusCode !== 200) {
      throw new ValidationError(
        'No se encontró la imagen subida en el almacenamiento remoto.'
      );
    }

    const header = await readStreamHeader(result.stream);
    assertBufferSignature(header, mimeType);
    return result.blob.url;
  }

  if (provider === 's3' || provider === 'r2') {
    const header = await readS3R2ObjectHeader(provider, key);
    assertBufferSignature(header, mimeType);
    return getProductImagePublicUrlForS3R2(provider, key);
  }

  throw new ValidationError(
    `Proveedor de almacenamiento no soportado: ${String(provider)}`
  );
}
