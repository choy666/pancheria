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

function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const e = error as { code?: unknown; cause?: unknown };
  if (e.code === code) return true;
  if (e.cause !== undefined && e.cause !== null) {
    return hasPostgresErrorCode(e.cause, code);
  }
  return false;
}

/**
 * `23505` = unique_violation de PostgreSQL. Se usa para traducir la
 * ventana de carrera entre el chequeo de nombre en aplicación y el
 * índice único `products_branch_name_lower_uniq` en un ValidationError
 * legible en vez de un 500 crudo.
 */
export function isUniqueViolationError(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    hasPostgresErrorCode(error.cause, '23505')
  );
}
