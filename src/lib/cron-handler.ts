import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getCronSecret } from '@/config/cron';
import { logger, logError } from '@/lib/logger';

/**
 * Envuelve un handler de cron con:
 * - Autenticación por `Authorization: Bearer ${CRON_SECRET}` (timing-safe).
 * - Log estructurado de inicio/fin con duración y resultados, y de error
 *   con stack serializado, para detectar corridas fallidas o silenciosas.
 *
 * El handler devuelve el payload JSON de éxito (se le agrega `ok: true`).
 */
export function withCronAuth(
  label: string,
  handler: (request: NextRequest) => Promise<Record<string, unknown>>
) {
  return async (request: NextRequest): Promise<Response> => {
    const authHeader = request.headers.get('authorization') ?? '';
    const cronSecret = getCronSecret();
    const expected = cronSecret ? `Bearer ${cronSecret}` : '';

    if (
      !expected ||
      authHeader.length !== expected.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const start = Date.now();
    logger.info(`${label}: inicio`, { source: 'cron' });

    try {
      const payload = await handler(request);
      logger.info(`${label}: fin`, {
        source: 'cron',
        durationMs: Date.now() - start,
        ...payload,
      });
      return NextResponse.json({ ok: true, ...payload });
    } catch (error) {
      logError(`${label}: error`, error, {
        source: 'cron',
        durationMs: Date.now() - start,
      });
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  };
}
