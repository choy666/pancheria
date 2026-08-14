import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import type { StorageProviderName } from '@/config/videos';

const mimeTypesByExtension: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
};

export function guessMimeType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return mimeTypesByExtension[extension] ?? 'video/mp4';
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

export function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), 'tmp', 'videos');
}

function getLocalBaseUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000';
  return env.replace(/\/$/, '');
}

export class LocalStorageProvider implements StorageProvider {
  async prepareUpload(file: FileInfo, _branchId: number): Promise<UploadInstructions> {
    void _branchId;
    const extension = path.extname(file.name) || '';
    const key = `${nanoid()}${extension}`;
    const url = `${getLocalBaseUrl()}/api/videos/upload`;
    const publicUrl = `${getLocalBaseUrl()}/api/videos/${encodeURIComponent(key)}/stream`;

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
    return `${getLocalBaseUrl()}/api/videos/${encodeURIComponent(keyOrUrl)}/stream`;
  }

  async saveFile(key: string, file: File): Promise<string> {
    const dir = getLocalStorageDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(/*turbopackIgnore: true*/ dir, /*turbopackIgnore: true*/ key);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return this.getPublicUrl(key);
  }

  async readFile(key: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const dir = getLocalStorageDir();
    const files = await fs.readdir(/*turbopackIgnore: true*/ dir);
    const match = files.find((f) => f === key);
    if (!match) return null;

    const filePath = path.join(/*turbopackIgnore: true*/ dir, /*turbopackIgnore: true*/ key);
    const buffer = await fs.readFile(filePath);
    return { buffer, mimeType: guessMimeType(key) };
  }
}

export class VercelBlobStorageProvider implements StorageProvider {
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

export class S3R2StorageProvider implements StorageProvider {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s3Client: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createPresignedPost: any;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientModule: any = await import(clientModuleName);
      s3Client = new clientModule.S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const presignerModule: any = await import(presignerModuleName);
      createPresignedPost = presignerModule.createPresignedPost;
    } catch {
      throw new Error(
        'Para usar STORAGE_PROVIDER=s3 o r2, instalá @aws-sdk/client-s3 y @aws-sdk/s3-presigned-post.'
      );
    }

    const extension = path.extname(file.name) || '';
    const key = `videos/${nanoid()}${extension}`;

    const publicUrl = this.getPublicUrl(key);

    const { url, fields } = await createPresignedPost(s3Client, {
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
