import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { dailyClosures } from '@/db/schema';

export async function findByDate(date: Date) {
  return db.query.dailyClosures.findFirst({
    where: eq(dailyClosures.date, date),
  });
}

export async function findByDateRange(start: Date, end: Date) {
  return db.query.dailyClosures.findMany({
    where: and(gte(dailyClosures.date, start), lte(dailyClosures.date, end)),
    orderBy: (dailyClosures, { desc }) => [desc(dailyClosures.date)],
  });
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
