import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getStorageProvider as getGlobalStorageProvider } from '@/config/videos';
import { getChatAllowedImageMimeTypes, getChatImageMaxSizeBytes } from '@/config/chat';
import { ValidationError } from '@/domain/errors';
import type { S3Client } from '@aws-sdk/client-s3';
import type { createPresignedPost } from '@aws-sdk/s3-presigned-post';

export interface ChatFileInfo {
  name: string;
  type: string;
  size: number;
}

export interface SavedChatAttachment {
  key: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  name: string;
}

function getLocalBaseUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000';
  return env.replace(/\/$/, '');
}

function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), 'tmp', 'videos');
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

function validateImage(file: ChatFileInfo): void {
  if (!getChatAllowedImageMimeTypes().includes(file.type)) {
    throw new ValidationError('El tipo de imagen no está permitido.');
  }

  if (file.size > getChatImageMaxSizeBytes()) {
    throw new ValidationError('La imagen excede el tamaño máximo permitido.');
  }
}

export async function saveChatAttachment(
  file: File,
  orderId: number
): Promise<SavedChatAttachment> {
  const info: ChatFileInfo = {
    name: file.name,
    type: file.type,
    size: file.size,
  };

  validateImage(info);

  const provider = getGlobalStorageProvider();

  if (provider === 'local') {
    return saveLocal(file, orderId, info);
  }

  if (provider === 'vercel-blob') {
    return saveVercelBlob(file, orderId, info);
  }

  return saveS3R2(file, orderId, info, provider);
}

async function saveLocal(
  file: File,
  orderId: number,
  info: ChatFileInfo
): Promise<SavedChatAttachment> {
  const key = `chat/${orderId}/${nanoid()}${getExtension(info.type)}`;
  const dir = path.join(/*turbopackIgnore: true*/ getLocalStorageDir(), /*turbopackIgnore: true*/ path.dirname(key));
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });

  const filePath = path.join(/*turbopackIgnore: true*/ getLocalStorageDir(), /*turbopackIgnore: true*/ key);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(/*turbopackIgnore: true*/ filePath, Buffer.from(arrayBuffer));

  return {
    key,
    publicUrl: `${getLocalBaseUrl()}/api/chat/attachment/${encodeURIComponent(key)}`,
    mimeType: info.type,
    size: info.size,
    name: info.name,
  };
}

async function saveVercelBlob(
  file: File,
  orderId: number,
  info: ChatFileInfo
): Promise<SavedChatAttachment> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new ValidationError('Falta BLOB_READ_WRITE_TOKEN para Vercel Blob.');
  }

  const key = `chat/${orderId}/${nanoid()}${getExtension(info.type)}`;

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
    name: info.name,
  };
}

async function saveS3R2(
  file: File,
  orderId: number,
  info: ChatFileInfo,
  kind: 's3' | 'r2'
): Promise<SavedChatAttachment> {
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

  const key = `chat/${orderId}/${nanoid()}${getExtension(info.type)}`;

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

  const { url, fields } = await createPresignedPostFn(s3Client, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 0, info.size],
      ['eq', '$Content-Type', info.type],
    ],
    Fields: { 'Content-Type': info.type },
    Expires: 600,
  });

  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  formData.append('file', file);

  const uploadResponse = await fetch(url, { method: 'POST', body: formData });
  if (!uploadResponse.ok) {
    throw new ValidationError('Error al subir el archivo al proveedor S3/R2.');
  }

  let publicUrl: string;
  if (endpoint) {
    publicUrl = `${endpoint.replace(/\/$/, '')}/${key}`;
  } else {
    publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  return {
    key,
    publicUrl,
    mimeType: info.type,
    size: info.size,
    name: info.name,
  };
}

export async function readChatAttachment(
  key: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const provider = getGlobalStorageProvider();

  if (provider !== 'local') {
    return null;
  }

  const dir = getLocalStorageDir();
  const filePath = path.join(/*turbopackIgnore: true*/ dir, /*turbopackIgnore: true*/ key);

  try {
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
