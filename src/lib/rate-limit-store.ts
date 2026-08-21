import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { loginAttempts } from '@/db/schema';

export type AttemptRecord = {
  count: number;
  lastAttempt: number;
};

export interface RateLimitStore {
  get(username: string): Promise<AttemptRecord | undefined>;
  set(username: string, record: AttemptRecord): Promise<void>;
  delete(username: string): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private attemptsByUsername = new Map<string, AttemptRecord>();

  async get(username: string): Promise<AttemptRecord | undefined> {
    return this.attemptsByUsername.get(username);
  }

  async set(username: string, record: AttemptRecord): Promise<void> {
    this.attemptsByUsername.set(username, record);
  }

  async delete(username: string): Promise<void> {
    this.attemptsByUsername.delete(username);
  }
}

class DbRateLimitStore implements RateLimitStore {
  async get(username: string): Promise<AttemptRecord | undefined> {
    const row = await db.query.loginAttempts.findFirst({
      where: eq(loginAttempts.username, username),
    });

    if (!row) {
      return undefined;
    }

    return { count: row.count, lastAttempt: row.lastAttempt };
  }

  async set(username: string, record: AttemptRecord): Promise<void> {
    await db
      .insert(loginAttempts)
      .values({
        username,
        count: record.count,
        lastAttempt: record.lastAttempt,
      })
      .onConflictDoUpdate({
        target: loginAttempts.username,
        set: {
          count: record.count,
          lastAttempt: record.lastAttempt,
        },
      });
  }

  async delete(username: string): Promise<void> {
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
