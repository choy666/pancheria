import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ValidationError } from '@/domain/errors';
import {
  createRateLimitStore,
  type RateLimitStore,
} from '@/lib/rate-limit-store';

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

let rateLimitStore: RateLimitStore = createRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
  rateLimitStore = store;
}

export function getRateLimitStore(): RateLimitStore {
  return rateLimitStore;
}

async function isRateLimited(username: string): Promise<boolean> {
  const record = await rateLimitStore.get(username);
  if (!record) return false;

  const now = Date.now();
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    await rateLimitStore.delete(username);
    return false;
  }

  return record.count >= MAX_FAILED_ATTEMPTS;
}

async function recordFailedAttempt(username: string) {
  const now = Date.now();
  const record = await rateLimitStore.get(username);

  if (!record || now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    await rateLimitStore.set(username, { count: 1, lastAttempt: now });
    return;
  }

  record.count += 1;
  record.lastAttempt = now;
  await rateLimitStore.set(username, record);
}

async function clearFailedAttempts(username: string) {
  await rateLimitStore.delete(username);
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; username: string; role: string; branchId: number; branchName: string } | null> {
  if (await isRateLimited(username)) {
    throw new ValidationError(
      'Demasiados intentos fallidos. Probá más tarde.'
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    with: {
      branch: true,
    },
  });

  if (!user) {
    await recordFailedAttempt(username);
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    await recordFailedAttempt(username);
    return null;
  }

  await clearFailedAttempts(username);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branch?.name ?? '',
  };
}
