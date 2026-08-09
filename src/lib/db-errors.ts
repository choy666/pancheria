import { DrizzleQueryError } from 'drizzle-orm/errors';
import { DatabaseConnectionError } from '@/domain/errors';

function hasConnectionErrorCode(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const e = error as { code?: unknown; errors?: unknown[]; cause?: unknown };

  if (e.code === 'ECONNREFUSED') return true;

  if (Array.isArray(e.errors) && e.errors.some(hasConnectionErrorCode)) {
    return true;
  }

  if (e.cause !== undefined && e.cause !== null) {
    return hasConnectionErrorCode(e.cause);
  }

  return false;
}

export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseConnectionError) return true;
  if (error instanceof DrizzleQueryError) {
    return hasConnectionErrorCode(error.cause);
  }
  return hasConnectionErrorCode(error);
}
