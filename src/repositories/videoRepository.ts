import { eq, and, count, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type {
  PaginatedResult,
  PaginationParams,
  VideoRow,
} from '@/domain/types';
import type { videoSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type VideoInsert = z.infer<typeof videoSchema>;
export type VideoUpdate = Partial<VideoInsert>;

/**
 * Listado paginado de videos. `filter` controla el criterio sobre la
 * papelera: `active` (default) excluye eliminados, `deleted` solo devuelve
 * los que están en papelera y `all` incluye ambos.
 */
export async function findAllPage(
  branchId: number,
  pagination: PaginationParams,
  filter: 'active' | 'deleted' | 'all' = 'active'
): Promise<PaginatedResult<VideoRow>> {
  const conditions = [eq(videos.branchId, branchId)];
  if (filter === 'active') {
    conditions.push(isNull(videos.deletedAt));
  } else if (filter === 'deleted') {
    conditions.push(isNotNull(videos.deletedAt));
  }

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(videos)
    .where(and(...conditions));

  const items = await db.query.videos.findMany({
    where: and(...conditions),
    orderBy: (videos, { asc: ascFn }) => [ascFn(videos.title)],
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return {
    items,
    total: Number(total),
    page: pagination.page,
    limit: pagination.limit,
  };
}

/**
 * Devuelve todas las `file_url` referenciadas por videos (incluye los que
 * están en papelera: su archivo se conserva hasta el hard-delete). La usa
 * el cleanup de archivos huérfanos para no borrar videos vivos.
 */
export async function findAllFileUrls(
  options: { limit?: number; offset?: number } = {}
): Promise<string[]> {
  let query = db
    .select({ fileUrl: videos.fileUrl })
    .from(videos)
    .$dynamic();

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options.offset !== undefined) {
    query = query.offset(options.offset);
  }

  const rows = await query;

  return rows.map((row) => row.fileUrl as string);
}

export async function findById(
  branchId: number,
  id: number,
  includeDeleted = false
): Promise<VideoRow | null> {
  const conditions = [eq(videos.id, id), eq(videos.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(videos.deletedAt));
  }

  const result = await db.query.videos.findFirst({
    where: and(...conditions),
  });
  return result ?? null;
}

export async function findActive(branchId: number): Promise<VideoRow[]> {
  return db.query.videos.findMany({
    where: and(
      eq(videos.branchId, branchId),
      eq(videos.isActive, true),
      isNull(videos.deletedAt)
    ),
    orderBy: (videos, { asc: ascFn }) => [ascFn(videos.title)],
  });
}

export async function create(data: VideoInsert & { branchId: number }): Promise<VideoRow | undefined> {
  const [result] = await db
    .insert(videos)
    .values({
      ...data,
      description: data.description ?? null,
      size: data.size ?? null,
      updatedAt: nowUTC(),
    })
    .returning();
  return result;
}

export async function update(
  branchId: number,
  id: number,
  data: VideoUpdate
): Promise<VideoRow | null> {
  const [result] = await db
    .update(videos)
    .set({
      ...data,
      updatedAt: nowUTC(),
    })
    .where(and(eq(videos.id, id), eq(videos.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function softDelete(branchId: number, id: number): Promise<VideoRow | null> {
  const [result] = await db
    .update(videos)
    .set({
      isActive: false,
      deletedAt: nowUTC(),
      updatedAt: nowUTC(),
    })
    .where(and(eq(videos.id, id), eq(videos.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function restore(branchId: number, id: number): Promise<VideoRow | null> {
  const [result] = await db
    .update(videos)
    .set({
      isActive: true,
      deletedAt: null,
      updatedAt: nowUTC(),
    })
    .where(and(eq(videos.id, id), eq(videos.branchId, branchId)))
    .returning();
  return result ?? null;
}

export async function hardDelete(branchId: number, id: number): Promise<VideoRow | null> {
  const [result] = await db
    .delete(videos)
    .where(and(eq(videos.id, id), eq(videos.branchId, branchId)))
    .returning();
  return result ?? null;
}
