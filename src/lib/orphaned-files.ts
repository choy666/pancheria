import { promises as fs } from 'fs';
import path from 'path';
import { getBlobReadWriteToken, getS3R2Credentials } from '@/config/storage';
import { logger } from '@/lib/logger';
import type { S3Client } from '@aws-sdk/client-s3';

/**
 * Helpers del cleanup de archivos huérfanos: listar claves por prefijo en
 * cada proveedor y borrar lo que no esté referenciado en la base.
 */

export interface OrphanCleanupResult {
  listed: number;
  deleted: number;
}

/**
 * Lista las claves locales bajo `dir`: archivos directos si `nested` es
 * false, o archivos un nivel por debajo (subcarpeta por entidad) si es
 * true. Devuelve paths relativos con separador '/'.
 */
export async function listLocalKeys(
  dir: string,
  nested: boolean
): Promise<string[]> {
  const keys: string[] = [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Si el directorio no existe, no hay archivos que listar.
    return keys;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!nested) continue;

      let files;
      try {
        files = await fs.readdir(path.join(dir, entry.name), {
          withFileTypes: true,
        });
      } catch {
        continue;
      }

      for (const file of files) {
        if (file.isDirectory()) continue;
        keys.push(`${entry.name}/${file.name}`);
      }
      continue;
    }

    keys.push(entry.name);
  }

  return keys;
}

/** Lista todas las claves del prefijo en Vercel Blob (paginado por cursor). */
async function listVercelBlobKeys(prefix: string): Promise<string[]> {
  const token = getBlobReadWriteToken();
  if (!token) return [];

  const { list } = await import('@vercel/blob');
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ token, prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      keys.push(blob.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return keys;
}

async function listS3R2Keys(
  provider: 's3' | 'r2',
  prefix: string
): Promise<string[]> {
  const credentials = getS3R2Credentials(provider);
  if (!credentials) return [];

  const { accessKeyId, secretAccessKey, bucket, region, endpoint } =
    credentials;

  // Import dinámico con nombre en variable (igual que en storage.ts): evita
  // cargar el SDK de AWS salvo que el proveedor sea s3/r2.
  const clientModuleName = '@aws-sdk/client-s3';
  const clientModule = (await import(clientModuleName)) as {
    S3Client: typeof S3Client;
    ListObjectsV2Command: typeof import('@aws-sdk/client-s3').ListObjectsV2Command;
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
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

/** Lista las claves del prefijo en el proveedor remoto indicado. */
export async function listRemoteKeys(
  provider: 'vercel-blob' | 's3' | 'r2',
  prefix: string
): Promise<string[]> {
  if (provider === 'vercel-blob') {
    return listVercelBlobKeys(prefix);
  }
  return listS3R2Keys(provider, prefix);
}

/**
 * Borra de `candidateKeys` todo lo que no esté en `liveKeys` y devuelve el
 * resultado. Un fallo individual se loguea y no aborta el resto.
 */
export async function deleteOrphanedKeys(
  candidateKeys: string[],
  liveKeys: Set<string>,
  deleteKey: (key: string) => Promise<void>
): Promise<OrphanCleanupResult> {
  let deleted = 0;

  for (const key of candidateKeys) {
    if (liveKeys.has(key)) continue;

    try {
      await deleteKey(key);
      deleted += 1;
    } catch (error) {
      logger.warn('No se pudo borrar el archivo huérfano', {
        source: 'orphan-cleanup',
        key,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { listed: candidateKeys.length, deleted };
}
