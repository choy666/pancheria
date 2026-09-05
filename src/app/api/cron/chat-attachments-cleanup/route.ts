import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import { getStorageProvider } from '@/config/videos';
import { getChatLocalStorageBasePath } from '@/lib/chat-storage';
import { getCronSecret } from '@/config/cron';
import { getBlobReadWriteToken, getS3R2Credentials } from '@/config/storage';

function getExpectedAuth(): string | undefined {
  const cronSecret = getCronSecret();
  if (!cronSecret) return undefined;
  return `Bearer ${cronSecret}`;
}

async function listLocalFiles(dir: string): Promise<string[]> {
  const result: string[] = [];

  try {
    const orderDirs = await fs.readdir(dir, { withFileTypes: true });
    for (const orderDir of orderDirs) {
      if (!orderDir.isDirectory()) continue;

      const orderPath = path.join(dir, orderDir.name);
      const files = await fs.readdir(orderPath, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) continue;
        result.push(`${orderDir.name}/${file.name}`);
      }
    }
  } catch {
    // Si el directorio no existe, no hay archivos que limpiar.
  }

  return result;
}

async function cleanupLocal(referencedKeys: Set<string>): Promise<number> {
  const basePath = getChatLocalStorageBasePath();
  const allFiles = await listLocalFiles(path.join(basePath, 'chat'));
  let deleted = 0;

  for (const relative of allFiles) {
    const key = `chat/${relative.replace(/\\/g, '/')}`;
    if (!referencedKeys.has(key)) {
      await fs.unlink(path.join(basePath, key));
      deleted += 1;
    }
  }

  return deleted;
}

async function cleanupVercelBlob(referencedKeys: Set<string>): Promise<number> {
  const { list, del } = await import('@vercel/blob');
  const token = getBlobReadWriteToken();
  if (!token) return 0;

  const { blobs } = await list({ token, prefix: 'chat/' });
  let deleted = 0;

  for (const blob of blobs) {
    if (!referencedKeys.has(blob.pathname)) {
      await del(blob.pathname, { token });
      deleted += 1;
    }
  }

  return deleted;
}

async function cleanupS3R2(
  provider: 's3' | 'r2',
  referencedKeys: Set<string>
): Promise<number> {
  const credentials = getS3R2Credentials(provider);
  if (!credentials) return 0;

  const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
    credentials;

  const clientModule = (await import('@aws-sdk/client-s3')) as {
    S3Client: typeof import('@aws-sdk/client-s3').S3Client;
    ListObjectsV2Command: typeof import('@aws-sdk/client-s3').ListObjectsV2Command;
    DeleteObjectsCommand: typeof import('@aws-sdk/client-s3').DeleteObjectsCommand;
  };

  const s3Client = new clientModule.S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new clientModule.ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'chat/',
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of response.Contents ?? []) {
      if (obj.Key && !referencedKeys.has(obj.Key)) {
        keys.push(obj.Key);
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (keys.length === 0) return 0;

  await s3Client.send(
    new clientModule.DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    })
  );

  return keys.length;
}

export async function GET(request: NextRequest) {
  const expected = getExpectedAuth() ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado.' },
      { status: 401 }
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  if (
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const referencedKeys = new Set(
    await orderMessageRepository.findAllAttachmentKeys()
  );

  const provider = getStorageProvider();
  let deleted = 0;

  if (provider === 'local') {
    deleted = await cleanupLocal(referencedKeys);
  } else if (provider === 'vercel-blob') {
    deleted = await cleanupVercelBlob(referencedKeys);
  } else if (provider === 's3' || provider === 'r2') {
    deleted = await cleanupS3R2(provider, referencedKeys);
  }

  return NextResponse.json({ ok: true, deleted });
}

export const runtime = 'nodejs';
