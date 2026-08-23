import { lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { publicOrderRateLimits } from '@/db/schema';

export interface PublicOrderRateLimitStore {
  /**
   * Registra un request y devuelve `true` si el IP superó el límite.
   * La operación es atómica: incrementa el contador si la ventana aún
   * no venció, o lo reinicia en caso contrario.
   */
  recordRequest(
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean>;
  cleanupExpired(): Promise<number>;
}

export class InMemoryPublicOrderRateLimitStore
  implements PublicOrderRateLimitStore
{
  private attemptsByIp = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async recordRequest(
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const now = Date.now();
    const record = this.attemptsByIp.get(ip);

    if (!record || now > record.resetAt) {
      this.attemptsByIp.set(ip, { count: 1, resetAt: now + windowMs });
      return 1 > maxRequests;
    }

    record.count += 1;
    return record.count > maxRequests;
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [ip, record] of this.attemptsByIp.entries()) {
      if (now > record.resetAt) {
        this.attemptsByIp.delete(ip);
        deleted += 1;
      }
    }

    return deleted;
  }
}

export class DbPublicOrderRateLimitStore
  implements PublicOrderRateLimitStore
{
  async recordRequest(
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const now = Date.now();

    const [row] = await db
      .insert(publicOrderRateLimits)
      .values({
        ip,
        count: 1,
        resetAt: now + windowMs,
      })
      .onConflictDoUpdate({
        target: publicOrderRateLimits.ip,
        set: {
          count: sql`CASE WHEN ${publicOrderRateLimits.resetAt} > ${now} THEN ${publicOrderRateLimits.count} + 1 ELSE 1 END`,
          resetAt: sql`CASE WHEN ${publicOrderRateLimits.resetAt} > ${now} THEN ${publicOrderRateLimits.resetAt} ELSE ${now + windowMs} END`,
        },
      })
      .returning({ count: publicOrderRateLimits.count });

    return (row?.count ?? 1) > maxRequests;
  }

  async cleanupExpired(): Promise<number> {
    const result = await db
      .delete(publicOrderRateLimits)
      .where(lt(publicOrderRateLimits.resetAt, Date.now()))
      .returning({ ip: publicOrderRateLimits.ip });
    return result.length;
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
