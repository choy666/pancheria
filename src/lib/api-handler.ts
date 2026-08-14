import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  DomainError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors';
import { isDatabaseConnectionError } from '@/lib/db-errors';
import { logError } from '@/lib/logger';

function isClientAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return (
      code === 'ECONNRESET' ||
      code === 'ECONNABORTED' ||
      error.name === 'AbortError' ||
      error.message === 'aborted' ||
      error.message === 'The destination stream closed early.'
    );
  }
  return false;
}

export function withApiErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>
) {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (error instanceof ZodError) {
        const message = error.issues.map((e) => e.message).join('. ');
        return NextResponse.json(
          { error: message, details: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error instanceof InsufficientStockError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      if (error instanceof DomainError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (isDatabaseConnectionError(error)) {
        return NextResponse.json(
          { error: 'Error de conexión con la base de datos' },
          { status: 503 }
        );
      }

      if (isClientAbortError(error)) {
        return new Response(null, { status: 499 });
      }

      logError('Error inesperado en API', error);
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}
