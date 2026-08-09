import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { logError } from '@/lib/logger';
import { isDatabaseConnectionError } from '@/lib/db-errors';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';
import type { CashRegisterStatus } from '@/domain/types';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
    const start = startParam
      ? parseDateStringUTC(startParam)
      : subDays(end, DEFAULT_CAJA_HISTORY_DAYS);
    const statusParam = searchParams.get('status');
    const status: CashRegisterStatus | undefined =
      statusParam === 'open' || statusParam === 'closed' ? statusParam : undefined;

    const cashRegisters = await cashRegisterService.listCashRegisterHistory(
      start,
      end,
      status
    );
    return NextResponse.json(cashRegisters);
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

    logError('Error al listar cajas', error);
    return NextResponse.json(
      { error: 'Error al listar cajas' },
      { status: 500 }
    );
  }
}
