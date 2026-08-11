import { eq, and, gte, lte, count } from 'drizzle-orm';
import { db } from '@/db';
import { dailyClosures } from '@/db/schema';
import type { PaginatedResult, PaginationParams } from '@/domain/types';

export async function findByDate(date: Date) {
  return db.query.dailyClosures.findFirst({
    where: eq(dailyClosures.date, date),
  });
}

export async function findByDateRange(
  start: Date,
  end: Date,
  pagination?: PaginationParams
): Promise<PaginatedResult<typeof dailyClosures.$inferSelect>> {
  const conditions = and(
    gte(dailyClosures.date, start),
    lte(dailyClosures.date, end)
  );

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(dailyClosures)
    .where(conditions);

  const limit = pagination?.limit;
  const offset = pagination ? (pagination.page - 1) * pagination.limit : undefined;

  const items = await db.query.dailyClosures.findMany({
    where: conditions,
    orderBy: (dailyClosures, { desc }) => [desc(dailyClosures.date)],
    limit,
    offset,
  });

  return {
    items,
    total: Number(total),
    page: pagination?.page ?? 1,
    limit: limit ?? total,
  };
}

export async function create(params: {
  date: Date;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary: string;
  criticalSuppliesSummary: string;
}) {
  const [result] = await db.insert(dailyClosures).values(params).returning();
  return result;
}
