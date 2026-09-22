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

/**
 * Etiqueta para los logs de la ruta: la explícita si se pasa, o
 * `METHOD /pathname` derivada de la request. Así todas las rutas loguean
 * duración y estado aunque no declaren `routeLabel`.
 */
function resolveRouteLabel(
  routeLabel: string | undefined,
  context: { method: string; url: string }
): string {
  if (routeLabel) return routeLabel;

  try {
    return `${context.method} ${new URL(context.url).pathname}`;
  } catch {
    return `${context.method} ${context.url}`;
  }
}

export function withApiErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
  routeLabel?: string
) {
  return async (...args: TArgs): Promise<Response> => {
    const start = Date.now();
    const context = extractRequestContext(args);
    const label = resolveRouteLabel(routeLabel, context);

    try {
      const response = await handler(...args);

      logger.info(label, {
        ...context,
        status: response.status,
        durationMs: Date.now() - start,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - start;

      if (error instanceof UnauthorizedError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
        logApiWarning(label, { ...context, durationMs, status: 401 });
        return response;
      }

      if (error instanceof ForbiddenError) {
        // `BranchRemovedError` lleva `code` para que el cliente distinga
        // el cierre de sesión obligatorio de un 403 de permisos común.
        const code =
          'code' in error && typeof error.code === 'string'
            ? error.code
            : undefined;
        const response = NextResponse.json(
          { error: error.message, ...(code ? { code } : {}) },
          { status: 403 }
        );
        logApiWarning(label, { ...context, durationMs, status: 403 });
        return response;
      }

      if (error instanceof ZodError) {
        const message = error.issues.map((e) => e.message).join('. ');
        const response = NextResponse.json(
          { error: message, details: error.issues },
          { status: 400 }
        );
        logApiWarning(label, { ...context, durationMs, status: 400 });
        return response;
      }

      if (error instanceof NotFoundError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
        logApiWarning(label, { ...context, durationMs, status: 404 });
        return response;
      }

      if (error instanceof InsufficientStockError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
        logApiWarning(label, { ...context, durationMs, status: 409 });
        return response;
      }

      if (error instanceof DomainError) {
        const response = NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
        logApiWarning(label, { ...context, durationMs, status: 400 });
        return response;
      }

      if (isDatabaseConnectionError(error)) {
        const response = NextResponse.json(
          { error: 'Error de conexión con la base de datos' },
          { status: 503 }
        );
        logApiError(label, {
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

      logApiError(label, { ...context, durationMs, status: 500, error });
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}

function logApiWarning(
  label: string,
  context: Record<string, unknown>
): void {
  logger.warn(label, context);
}

function logApiError(
  label: string,
  context: Record<string, unknown>
): void {
  logger.error(label, context);
}
