import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { videos } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { VideoRow } from '@/domain/types';
import type { videoSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

export type VideoInsert = z.infer<typeof videoSchema>;
export type VideoUpdate = Partial<VideoInsert>;

export async function findAll(
  branchId: number,
  includeDeleted = false
): Promise<VideoRow[]> {
  const conditions = [eq(videos.branchId, branchId)];
  if (!includeDeleted) {
    conditions.push(isNull(videos.deletedAt));
  }

  return db.query.videos.findMany({
    where: and(...conditions),
    orderBy: (videos, { asc: ascFn }) => [ascFn(videos.title)],
  });
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
