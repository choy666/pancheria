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
import { logger } from '@/lib/logger';

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

function extractRequestContext(args: unknown[]): {
  method: string;
  url: string;
} {
  const request = args[0];

  if (request instanceof Request) {
    return { method: request.method, url: request.url };
  }

  if (
    request &&
    typeof request === 'object' &&
    'method' in request &&
    'url' in request
  ) {
    return {
      method: String((request as { method?: unknown }).method ?? 'UNKNOWN'),
      url: String((request as { url?: unknown }).url ?? 'unknown'),
    };
  }

  return { method: 'UNKNOWN', url: 'unknown' };
}

export function withApiErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
  routeLabel?: string
) {
  return async (...args: TArgs): Promise<Response> => {
    const start = Date.now();
    const context = extractRequestContext(args);

    try {
      const response = await handler(...args);

      if (routeLabel) {
        logger.info(routeLabel, {
          ...context,
          status: response.status,
          durationMs: Date.now() - start,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - start;

      if (error instanceof UnauthorizedError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 401 });
        return response;
      }

      if (error instanceof ForbiddenError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 403 });
        return response;
      }

      if (error instanceof ZodError) {
        const message = error.issues.map((e) => e.message).join('. ');
        const response = NextResponse.json(
          { error: message, details: error.issues },
          { status: 400 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 400 });
        return response;
      }

      if (error instanceof NotFoundError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 404 });
        return response;
      }

      if (error instanceof InsufficientStockError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 409 });
        return response;
      }

      if (error instanceof DomainError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
        logApiWarning(routeLabel, { ...context, durationMs, status: 400 });
        return response;
      }

      if (isDatabaseConnectionError(error)) {
        const response = NextResponse.json(
          { error: 'Error de conexión con la base de datos' },
          { status: 503 }
        );
        logApiError(routeLabel, {
          ...context,
          durationMs,
          status: 503,
          error,
        });
        return response;
      }

      if (isClientAbortError(error)) {
        logger.debug('Cliente abortó la conexión', {
          ...context,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        return new Response(null, { status: 499 });
      }

      logApiError(routeLabel, { ...context, durationMs, status: 500, error });
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}

function logApiWarning(
  routeLabel: string | undefined,
  context: Record<string, unknown>
): void {
  if (routeLabel) {
    logger.warn(routeLabel, context);
  }
}

function logApiError(
  routeLabel: string | undefined,
  context: Record<string, unknown>
): void {
  if (routeLabel) {
    logger.error(routeLabel, context);
  }
}
