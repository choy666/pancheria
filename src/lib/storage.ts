import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getPublicBaseUrl } from '@/lib/public-url';
import {
  getLocalStorageBasePath,
  getBlobReadWriteToken,
  getS3R2Credentials,
  getS3R2Bucket,
  getS3R2Endpoint,
  getS3PublicUrlRegion,
} from '@/config/storage';
import {
  getVideoAllowedMimeTypes,
  getStorageProvider as getStorageProviderName,
  type StorageProviderName,
} from '@/config/videos';
import { ValidationError } from '@/domain/errors';
import type { S3Client } from '@aws-sdk/client-s3';
import type { createPresignedPost } from '@aws-sdk/s3-presigned-post';

// ---------------------------------------------------------------------------
// Validación de firma (magic bytes)
// ---------------------------------------------------------------------------
// Verifica que los primeros bytes del archivo correspondan al tipo MIME
// declarado, para no confiar únicamente en el Content-Type que envía el
// cliente. Las firmas cubren los tipos permitidos por defecto (imágenes
// JPEG/PNG/WebP y videos MP4/WebM/OGG) más variantes habituales
// (QuickTime, Matroska, AVI).

const SIGNATURE_READ_BYTES = 16;

function matchesBytes(
  header: Uint8Array,
  expected: readonly number[],
  offset = 0
): boolean {
  if (header.length < offset + expected.length) return false;
  return expected.every((byte, index) => header[offset + index] === byte);
}

const signatureCheckers: Record<string, (header: Uint8Array) => boolean> = {
  // JPEG: FF D8 FF
  'image/jpeg': (h) => matchesBytes(h, [0xff, 0xd8, 0xff]),
  // PNG: 89 50 4E 47 ('.PNG')
  'image/png': (h) => matchesBytes(h, [0x89, 0x50, 0x4e, 0x47]),
  // WebP: 'RIFF' .... 'WEBP'
  'image/webp': (h) =>
    matchesBytes(h, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(h, [0x57, 0x45, 0x42, 0x50], 8),
  // MP4/MOV (ISO Base Media): tamaño de caja (4 bytes) + 'ftyp'
  'video/mp4': (h) => matchesBytes(h, [0x66, 0x74, 0x79, 0x70], 4),
  'video/quicktime': (h) => matchesBytes(h, [0x66, 0x74, 0x79, 0x70], 4),
  // WebM/MKV (EBML): 1A 45 DF A3
  'video/webm': (h) => matchesBytes(h, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/x-matroska': (h) => matchesBytes(h, [0x1a, 0x45, 0xdf, 0xa3]),
  // OGG: 'OggS'
  'video/ogg': (h) => matchesBytes(h, [0x4f, 0x67, 0x67, 0x53]),
  // AVI: 'RIFF' .... 'AVI '
  'video/x-msvideo': (h) =>
    matchesBytes(h, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(h, [0x41, 0x56, 0x49, 0x20], 8),
};

/**
 * Indica si los primeros bytes del archivo coinciden con la firma esperada
 * para el `mimeType` declarado. Tipos sin firma conocida se rechazan
 * (fail closed): la lista de tipos permitidos es configurable, pero un tipo
 * sin verificación de contenido no aporta defensa contra archivos disfrazados.
 */
function hasExpectedFileSignature(
  header: Uint8Array,
  mimeType: string
): boolean {
  const checker = signatureCheckers[mimeType];
  if (!checker) return false;
  return checker(header);
}

/**
 * Lee los primeros bytes de `file` y lanza `ValidationError` si el contenido
 * no coincide con la firma esperada para `mimeType`.
 */
export async function assertFileSignature(
  file: Blob,
  mimeType: string
): Promise<void> {
  const header = new Uint8Array(
    await file.slice(0, SIGNATURE_READ_BYTES).arrayBuffer()
  );
  if (!hasExpectedFileSignature(header, mimeType)) {
    throw new ValidationError(
      'El contenido del archivo no coincide con el tipo declarado.'
    );
  }
}

const mimeTypesByExtension: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
};

const extensionByMimeType: Record<string, string> = Object.fromEntries(
  Object.entries(mimeTypesByExtension).map(([ext, mime]) => [mime, ext])
);

export function guessMimeType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return mimeTypesByExtension[extension] ?? 'video/mp4';
}

function getExtensionFromMimeType(mimeType: string): string {
  return extensionByMimeType[mimeType] ?? '';
}

function getAllowedLocalVideoExtensions(): string[] {
  const allowedTypes = getVideoAllowedMimeTypes();
  const extensions = new Set<string>();
  for (const type of allowedTypes) {
    const ext = getExtensionFromMimeType(type);
    if (ext) extensions.add(ext);
  }
  // Siempre mantener las extensiones clásicas como fallback.
  extensions.add('.mp4');
  extensions.add('.webm');
  extensions.add('.ogg');
  extensions.add('.ogv');
  return Array.from(extensions);
}

const SAFE_LOCAL_VIDEO_KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?$/;

export function isValidLocalVideoKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0) return false;
  if (!SAFE_LOCAL_VIDEO_KEY_PATTERN.test(key)) return false;
  const ext = path.extname(key).toLowerCase();
  if (ext === '') return false;
  return getAllowedLocalVideoExtensions().includes(ext);
}

export function resolveLocalVideoPath(key: string, baseDir?: string): string {
  if (!isValidLocalVideoKey(key)) {
    throw new ValidationError('Identificador de video inválido.');
  }
  const dir = baseDir ?? getLocalStorageDir();
  const resolved = path.resolve(
    /*turbopackIgnore: true*/ dir,
    /*turbopackIgnore: true*/ key
  );
  const baseResolved = path.resolve(/*turbopackIgnore: true*/ dir);
  if (!resolved.startsWith(baseResolved + path.sep)) {
    throw new ValidationError('Ruta de video fuera del directorio permitido.');
  }
  return resolved;
}

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export interface UploadInstructions {
  url: string;
  method: 'POST' | 'PUT';
  fields?: Record<string, string>;
  token?: string;
  key: string;
  publicUrl: string;
}

export interface StorageProvider {
  prepareUpload(file: FileInfo, branchId: number): Promise<UploadInstructions>;
  getPublicUrl(keyOrUrl: string): string;
  saveFile?(key: string, file: File): Promise<string>;
  readFile?(key: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  deleteFile?(key: string): Promise<void>;
}

function getLocalStorageDir(): string {
  return getLocalStorageBasePath();
}

class LocalStorageProvider implements StorageProvider {
  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const nameExtension = path.extname(file.name).toLowerCase();
    const allowedExtensions = getAllowedLocalVideoExtensions();
    const extension = allowedExtensions.includes(nameExtension)
      ? nameExtension
      : getExtensionFromMimeType(file.type) || '.mp4';
    const key = `${nanoid()}${extension}`;
    const url = `${getPublicBaseUrl()}/api/videos/upload`;
    const publicUrl = `${getPublicBaseUrl()}/api/videos/${encodeURIComponent(key)}/stream`;

    return {
      url,
      method: 'POST',
      fields: { key, filename: file.name, mimeType: file.type },
      key,
      publicUrl,
    };
  }

  getPublicUrl(keyOrUrl: string): string {
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      return keyOrUrl;
    }
    return `${getPublicBaseUrl()}/api/videos/${encodeURIComponent(keyOrUrl)}/stream`;
  }

  async saveFile(key: string, file: File): Promise<string> {
    const dir = getLocalStorageDir();
    const filePath = resolveLocalVideoPath(key, dir);
    // Validar magic bytes contra el MIME declarado (o el inferido de la clave
    // si el cliente no envió Content-Type) antes de escribir en disco.
    await assertFileSignature(file, file.type || guessMimeType(key));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return this.getPublicUrl(key);
  }

  async readFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!isValidLocalVideoKey(key)) return null;
    const dir = getLocalStorageDir();
    const filePath = resolveLocalVideoPath(key, dir);
    try {
      const buffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
      return { buffer, mimeType: guessMimeType(key) };
    } catch {
      return null;
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!isValidLocalVideoKey(key)) return;
    const dir = getLocalStorageDir();
    const filePath = resolveLocalVideoPath(key, dir);
    try {
      await fs.unlink(/*turbopackIgnore: true*/ filePath);
    } catch {
      // Ignorar errores si el archivo no existe.
    }
  }
}

class VercelBlobStorageProvider implements StorageProvider {
  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const token = getBlobReadWriteToken();
    if (!token) {
      throw new Error(
        'Falta BLOB_READ_WRITE_TOKEN para usar el proveedor de Vercel Blob.'
      );
    }

    const extension = path.extname(file.name) || '';
    const key = `videos/${nanoid()}${extension}`;

    const clientModule = await import('@vercel/blob/client');
    const clientToken = await clientModule.generateClientTokenFromReadWriteToken({
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

  getPublicUrl(keyOrUrl: string): string {
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      return keyOrUrl;
    }
    return `https://blob.vercel-storage.com/${keyOrUrl}`;
  }

  async deleteFile(key: string): Promise<void> {
    const token = getBlobReadWriteToken();
    if (!token) {
      throw new Error(
        'Falta BLOB_READ_WRITE_TOKEN para usar el proveedor de Vercel Blob.'
      );
    }

    const { del } = await import('@vercel/blob');
    await del(key, { token });
  }
}

class S3R2StorageProvider implements StorageProvider {
  private readonly kind: 's3' | 'r2';

  constructor(kind: 's3' | 'r2') {
    this.kind = kind;
  }

  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const credentials = getS3R2Credentials(this.kind);

    if (!credentials) {
      throw new Error(
        'Faltan credenciales de S3/R2. Configurá S3_* o R2_* según el proveedor.'
      );
    }

    const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
      credentials;

    const clientModuleName = '@aws-sdk/client-s3';
    const presignerModuleName = '@aws-sdk/s3-presigned-post';

    let s3Client: S3Client;
    let createPresignedPostFn: typeof createPresignedPost;

    try {
      const clientModule = (await import(clientModuleName)) as {
        S3Client: typeof S3Client;
      };
      s3Client = new clientModule.S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const presignerModule = (await import(presignerModuleName)) as {
        createPresignedPost: typeof createPresignedPost;
      };
      createPresignedPostFn = presignerModule.createPresignedPost;
    } catch {
      throw new Error(
        'Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3 y @aws-sdk/s3-presigned-post.'
      );
    }

    const extension = path.extname(file.name) || '';
    const key = `videos/${nanoid()}${extension}`;

    const publicUrl = this.getPublicUrl(key);

    const { url, fields } = await createPresignedPostFn(s3Client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, file.size],
        ['eq', '$Content-Type', file.type],
      ],
      Fields: {
        'Content-Type': file.type,
      },
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

  getPublicUrl(keyOrUrl: string): string {
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      return keyOrUrl;
    }

    const bucket = getS3R2Bucket();
    const endpoint = getS3R2Endpoint(this.kind);

    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${keyOrUrl}`;
    }

    const region = getS3PublicUrlRegion();
    return `https://${bucket}.s3.${region}.amazonaws.com/${keyOrUrl}`;
  }

  async deleteFile(key: string): Promise<void> {
    const credentials = getS3R2Credentials(this.kind);

    if (!credentials) {
      throw new Error('Faltan credenciales de S3/R2.');
    }

    const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
      credentials;

    const clientModuleName = '@aws-sdk/client-s3';

    try {
      const clientModule = (await import(clientModuleName)) as {
        S3Client: typeof S3Client;
        DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand;
      };

      const s3Client = new clientModule.S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });

      await s3Client.send(
        new clientModule.DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
    } catch {
      throw new Error('Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3.');
    }
  }
}

let localProvider: LocalStorageProvider | null = null;
let vercelProvider: VercelBlobStorageProvider | null = null;
let s3Provider: S3R2StorageProvider | null = null;
let r2Provider: S3R2StorageProvider | null = null;

export function getStorageProvider(name: StorageProviderName): StorageProvider {
  switch (name) {
    case 'local':
      if (!localProvider) {
        localProvider = new LocalStorageProvider();
      }
      return localProvider;
    case 'vercel-blob':
      if (!vercelProvider) {
        vercelProvider = new VercelBlobStorageProvider();
      }
      return vercelProvider;
    case 's3':
      if (!s3Provider) {
        s3Provider = new S3R2StorageProvider('s3');
      }
      return s3Provider;
    case 'r2':
      if (!r2Provider) {
        r2Provider = new S3R2StorageProvider('r2');
      }
      return r2Provider;
    default:
      throw new Error(`Proveedor de almacenamiento no soportado: ${name}`);
  }
}

export async function deleteStorageFile(key: string): Promise<void> {
  const providerName = getStorageProviderName();
  const provider = getStorageProvider(providerName);

  if (!provider.deleteFile) {
    throw new Error('El proveedor de almacenamiento no soporta eliminar archivos.');
  }

  await provider.deleteFile(key);
}

const LOCAL_VIDEO_STREAM_PATTERN = /\/api\/videos\/(.+?)\/stream$/;

function extractVideoKeyFromUrl(fileUrl: string): string | null {
  if (
    !fileUrl.startsWith('http://') &&
    !fileUrl.startsWith('https://')
  ) {
    // Ya es una clave relativa.
    return fileUrl;
  }

  try {
    const parsed = new URL(fileUrl);

    const localMatch = parsed.pathname.match(LOCAL_VIDEO_STREAM_PATTERN);
    if (localMatch) {
      return decodeURIComponent(localMatch[1]);
    }

    const key = parsed.pathname.replace(/^\//, '');
    if (key) return decodeURIComponent(key);
  } catch {
    // Ignorar URLs inválidas.
  }

  return null;
}

export async function deleteVideoFileByUrl(fileUrl: string): Promise<void> {
  const key = extractVideoKeyFromUrl(fileUrl);
  if (!key) return;

  try {
    await deleteStorageFile(key);
  } catch {
    // Ignorar errores si el archivo no existe o el proveedor falla.
  }
}
