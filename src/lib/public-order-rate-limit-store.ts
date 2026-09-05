import { lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { publicOrderRateLimits } from '@/db/schema';
import { isProduction, isTest, hasDatabaseUrl } from '@/config/env';
import { getPublicOrderRateLimitStoreProvider } from '@/config/rate-limit';

export interface PublicOrderRateLimitStore {
  /**
   * Registra un request y devuelve `true` si el IP superó el límite.
   * La operación es atómica: incrementa el contador si la ventana aún
   * no venció, o lo reinicia en caso contrario.
   *
   * El `scope` separa contadores por funcionalidad (por ejemplo, `pedido`
   * y `chat`) para que un límite alcanzado en uno no bloquee el otro.
   */
  recordRequest(
    scope: string,
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean>;
  cleanupExpired(): Promise<number>;
}

const CLEANUP_INTERVAL = 100;

export class InMemoryPublicOrderRateLimitStore
  implements PublicOrderRateLimitStore
{
  private attemptsByScopeAndIp = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private requestCount = 0;

  private key(scope: string, ip: string): string {
    return `${scope}:${ip}`;
  }

  async recordRequest(
    scope: string,
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const now = Date.now();
    const scopeIpKey = this.key(scope, ip);
    const record = this.attemptsByScopeAndIp.get(scopeIpKey);

    this.requestCount += 1;
    if (this.requestCount % CLEANUP_INTERVAL === 0) {
      await this.cleanupExpired();
    }

    if (!record || now > record.resetAt) {
      this.attemptsByScopeAndIp.set(scopeIpKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return 1 > maxRequests;
    }

    record.count += 1;
    return record.count > maxRequests;
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [scopeIpKey, record] of this.attemptsByScopeAndIp.entries()) {
      if (now > record.resetAt) {
        this.attemptsByScopeAndIp.delete(scopeIpKey);
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
    scope: string,
    ip: string,
    windowMs: number,
    maxRequests: number
  ): Promise<boolean> {
    const now = Date.now();

    const [row] = await db
      .insert(publicOrderRateLimits)
      .values({
        scope,
        ip,
        count: 1,
        resetAt: now + windowMs,
      })
      .onConflictDoUpdate({
        target: [publicOrderRateLimits.scope, publicOrderRateLimits.ip],
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
      .returning({ scope: publicOrderRateLimits.scope, ip: publicOrderRateLimits.ip });
    return result.length;
  }
}

export function createPublicOrderRateLimitStore(): PublicOrderRateLimitStore {
  const provider = getPublicOrderRateLimitStoreProvider();

  if (provider === 'db') {
    return new DbPublicOrderRateLimitStore();
  }

  if (provider === 'memory') {
    return new InMemoryPublicOrderRateLimitStore();
  }

  if (isTest()) {
    return new InMemoryPublicOrderRateLimitStore();
  }

  if (isProduction() && hasDatabaseUrl()) {
    return new DbPublicOrderRateLimitStore();
  }

  return new InMemoryPublicOrderRateLimitStore();
}
