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

async function clearFailedAttempts(username: string) {
  await rateLimitStore.recordSuccessfulAttempt(username);
}

async function recordFailedAttempt(username: string) {
  const blocked = await rateLimitStore.recordFailedAttempt(
    username,
    RATE_LIMIT_WINDOW_MS,
    MAX_FAILED_ATTEMPTS
  );

  if (blocked) {
    throw new ValidationError(
      'Demasiados intentos fallidos. Probá más tarde.'
    );
  }
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; username: string; role: string; branchId: number; branchName: string } | null> {
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
