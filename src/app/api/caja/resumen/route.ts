import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { logError } from '@/lib/logger';
import { isDatabaseConnectionError } from '@/lib/db-errors';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    const live = await cashRegisterService.getOpenCashRegisterSummary();

    if (!live) {
      return NextResponse.json({ status: 'closed' });
    }

    return NextResponse.json(live);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo.',
        },
        { status: 503 }
      );
    }

    logError('Error al obtener resumen de caja', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de caja' },
      { status: 500 }
    );
  }
}
