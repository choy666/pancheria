import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { publicOrderRateLimits } from '@/db/schema';

export type PublicOrderRateLimitRecord = {
  count: number;
  resetAt: number;
};

export interface PublicOrderRateLimitStore {
  get(ip: string): Promise<PublicOrderRateLimitRecord | undefined>;
  set(ip: string, record: PublicOrderRateLimitRecord): Promise<void>;
  delete(ip: string): Promise<void>;
}

export class InMemoryPublicOrderRateLimitStore
  implements PublicOrderRateLimitStore
{
  private attemptsByIp = new Map<string, PublicOrderRateLimitRecord>();

  async get(ip: string): Promise<PublicOrderRateLimitRecord | undefined> {
    return this.attemptsByIp.get(ip);
  }

  async set(ip: string, record: PublicOrderRateLimitRecord): Promise<void> {
    this.attemptsByIp.set(ip, record);
  }

  async delete(ip: string): Promise<void> {
    this.attemptsByIp.delete(ip);
  }
}

export class DbPublicOrderRateLimitStore
  implements PublicOrderRateLimitStore
{
  async get(ip: string): Promise<PublicOrderRateLimitRecord | undefined> {
    const row = await db.query.publicOrderRateLimits.findFirst({
      where: eq(publicOrderRateLimits.ip, ip),
    });

    if (!row) {
      return undefined;
    }

    return { count: row.count, resetAt: row.resetAt };
  }

  async set(ip: string, record: PublicOrderRateLimitRecord): Promise<void> {
    await db
      .insert(publicOrderRateLimits)
      .values({
        ip,
        count: record.count,
        resetAt: record.resetAt,
      })
      .onConflictDoUpdate({
        target: publicOrderRateLimits.ip,
        set: {
          count: record.count,
          resetAt: record.resetAt,
        },
      });
  }

  async delete(ip: string): Promise<void> {
    await db
      .delete(publicOrderRateLimits)
      .where(eq(publicOrderRateLimits.ip, ip));
  }
}

export function createPublicOrderRateLimitStore(): PublicOrderRateLimitStore {
  const provider = process.env.PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER;

  if (provider === 'db') {
    return new DbPublicOrderRateLimitStore();
  }

  if (provider === 'memory') {
    return new InMemoryPublicOrderRateLimitStore();
  }

  if (process.env.NODE_ENV === 'test') {
    return new InMemoryPublicOrderRateLimitStore();
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.DATABASE_URL || process.env.POSTGRES_URL)
  ) {
    return new DbPublicOrderRateLimitStore();
  }

  return new InMemoryPublicOrderRateLimitStore();
}
