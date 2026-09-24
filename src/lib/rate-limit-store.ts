import { eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { loginAttempts } from '@/db/schema';
import { isProduction, isTest, hasDatabaseUrl } from '@/config/env';
import { getRateLimitStoreProvider } from '@/config/rate-limit';

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
  /**
   * Devuelve `true` si el usuario ya alcanzó el máximo de intentos fallidos
   * dentro de la ventana vigente, sin registrar un intento nuevo. Permite
   * bloquear preventivamente (también credenciales correctas) hasta que la
   * ventana expire.
   */
  isBlocked(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean>;
  recordSuccessfulAttempt(username: string): Promise<void>;
  remove(username: string): Promise<void>;
  /**
   * Borra los intentos cuyo `lastAttempt` supere la retención indicada y
   * devuelve la cantidad eliminada. Acota el crecimiento de
   * `login_attempts`, que registra una fila por intento fallido incluso
   * para usuarios inexistentes.
   */
  cleanupStale(retentionMs: number): Promise<number>;
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

  async isBlocked(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean> {
    const record = this.attemptsByUsername.get(username);
    if (!record) return false;
    if (Date.now() - record.lastAttempt > windowMs) return false;
    return record.count >= maxAttempts;
  }

  async recordSuccessfulAttempt(username: string): Promise<void> {
    this.attemptsByUsername.delete(username);
  }

  async remove(username: string): Promise<void> {
    this.attemptsByUsername.delete(username);
  }

  async cleanupStale(retentionMs: number): Promise<number> {
    const cutoff = Date.now() - retentionMs;
    let deleted = 0;

    for (const [username, record] of this.attemptsByUsername.entries()) {
      if (record.lastAttempt < cutoff) {
        this.attemptsByUsername.delete(username);
        deleted += 1;
      }
    }

    return deleted;
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

  async isBlocked(
    username: string,
    windowMs: number,
    maxAttempts: number
  ): Promise<boolean> {
    const now = Date.now();
    const row = await db.query.loginAttempts.findFirst({
      where: eq(loginAttempts.username, username),
      columns: { count: true, lastAttempt: true },
    });

    if (!row) return false;
    if (row.lastAttempt + windowMs <= now) return false;
    return row.count >= maxAttempts;
  }

  async recordSuccessfulAttempt(username: string): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  }

  async remove(username: string): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
  }

  async cleanupStale(retentionMs: number): Promise<number> {
    const result = await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.lastAttempt, Date.now() - retentionMs))
      .returning({ username: loginAttempts.username });
    return result.length;
  }
}

let rateLimitStoreSingleton: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (!rateLimitStoreSingleton) {
    rateLimitStoreSingleton = createRateLimitStore();
  }
  return rateLimitStoreSingleton;
}

export function setRateLimitStore(store: RateLimitStore): void {
  rateLimitStoreSingleton = store;
}

export function createRateLimitStore(): RateLimitStore {
  const provider = getRateLimitStoreProvider();

  if (provider === 'db') {
    return new DbRateLimitStore();
  }

  if (provider === 'memory') {
    return new InMemoryRateLimitStore();
  }

  if (isTest()) {
    return new InMemoryRateLimitStore();
  }

  if (isProduction() && hasDatabaseUrl()) {
    return new DbRateLimitStore();
  }

  return new InMemoryRateLimitStore();
}
