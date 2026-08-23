import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { loginAttempts } from '@/db/schema';

export interface RateLimitStore {
  /**
   * Registra un intento fallido y devuelve `true` si el usuario
   * superó el límite. La operación es atómica.
   */
  recordFailedAttempt(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean>;
  recordSuccessfulAttempt(username: string): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private attemptsByUsername = new Map<
    string,
    { count: number; lastAttempt: number }
  >();

  async recordFailedAttempt(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean> {
    const now = Date.now();
    const record = this.attemptsByUsername.get(username);

    if (!record || now - record.lastAttempt > windowMs) {
      this.attemptsByUsername.set(username, { count: 1, lastAttempt: now });
      return 1 > maxAttempts;
    }

    record.count += 1;
    record.lastAttempt = now;
    return record.count > maxAttempts;
  }

  async recordSuccessfulAttempt(username: string): Promise<void> {
    this.attemptsByUsername.delete(username);
  }
}

class DbRateLimitStore implements RateLimitStore {
  async recordFailedAttempt(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean> {
    const now = Date.now();

    const [row] = await db
      .insert(loginAttempts)
      .values({
        username,
        count: 1,
        lastAttempt: now,
      })
      .onConflictDoUpdate({
        target: loginAttempts.username,
        set: {
          count: sql`CASE WHEN ${loginAttempts.lastAttempt} + ${windowMs} > ${now} THEN ${loginAttempts.count} + 1 ELSE 1 END`,
          lastAttempt: now,
        },
      })
      .returning({ count: loginAttempts.count });

    return (row?.count ?? 1) > maxAttempts;
  }

  async recordSuccessfulAttempt(username: string): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  }
}

export function createRateLimitStore(): RateLimitStore {
  const provider = process.env.RATE_LIMIT_STORE_PROVIDER;

  if (provider === 'db') {
    return new DbRateLimitStore();
  }

  if (provider === 'memory') {
    return new InMemoryRateLimitStore();
  }

  if (process.env.NODE_ENV === 'test') {
    return new InMemoryRateLimitStore();
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.DATABASE_URL || process.env.POSTGRES_URL)
  ) {
    return new DbRateLimitStore();
  }

  return new InMemoryRateLimitStore();
}
