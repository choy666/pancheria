import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getPublicBaseUrl } from '@/lib/public-url';
import {
  getVideoAllowedMimeTypes,
  type StorageProviderName,
} from '@/config/videos';
import type { S3Client } from '@aws-sdk/client-s3';
import type { createPresignedPost } from '@aws-sdk/s3-presigned-post';

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
    throw new Error('Identificador de video inválido.');
  }
  const dir = baseDir ?? getLocalStorageDir();
  const resolved = path.resolve(
    /*turbopackIgnore: true*/ dir,
    /*turbopackIgnore: true*/ key
  );
  const baseResolved = path.resolve(/*turbopackIgnore: true*/ dir);
  if (!resolved.startsWith(baseResolved + path.sep)) {
    throw new Error('Ruta de video fuera del directorio permitido.');
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
}

function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), 'tmp', 'videos');
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
}

class VercelBlobStorageProvider implements StorageProvider {
  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
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
}

class S3R2StorageProvider implements StorageProvider {
  private readonly kind: 's3' | 'r2';

  constructor(kind: 's3' | 'r2') {
    this.kind = kind;
  }

  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
    const bucket =
      process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
    const region =
      process.env.S3_REGION ??
      process.env.R2_REGION ??
      'auto';
    const endpoint =
      process.env.S3_ENDPOINT ??
      (this.kind === 'r2' && process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Faltan credenciales de S3/R2. Configurá S3_* o R2_* según el proveedor.'
      );
    }

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

    const bucket =
      process.env.S3_BUCKET ?? process.env.R2_BUCKET_NAME;
    const endpoint =
      process.env.S3_ENDPOINT ??
      (this.kind === 'r2' && process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${keyOrUrl}`;
    }

    const region = process.env.S3_REGION ?? 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${keyOrUrl}`;
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
