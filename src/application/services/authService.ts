import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ValidationError } from '@/domain/errors';

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = {
  count: number;
  lastAttempt: number;
};

const attemptsByUsername = new Map<string, AttemptRecord>();

function isRateLimited(username: string): boolean {
  const record = attemptsByUsername.get(username);
  if (!record) return false;

  const now = Date.now();
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    attemptsByUsername.delete(username);
    return false;
  }

  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(username: string) {
  const now = Date.now();
  const record = attemptsByUsername.get(username);

  if (!record || now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    attemptsByUsername.set(username, { count: 1, lastAttempt: now });
    return;
  }

  record.count += 1;
  record.lastAttempt = now;
}

function clearFailedAttempts(username: string) {
  attemptsByUsername.delete(username);
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; username: string } | null> {
  if (isRateLimited(username)) {
    throw new ValidationError(
      'Demasiados intentos fallidos. Probá más tarde.'
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    recordFailedAttempt(username);
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    recordFailedAttempt(username);
    return null;
  }

  clearFailedAttempts(username);

  return { id: user.id, username: user.username };
}
