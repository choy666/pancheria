import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { logError } from '@/lib/logger';
import { DomainError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';

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

    const cashRegisters = await cashRegisterService.listDeletedCashRegisterHistory(
      start,
      end
    );
    return NextResponse.json(cashRegisters);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logError('Error al listar cajas eliminadas', error);
    return NextResponse.json(
      { error: 'Error al listar cajas eliminadas' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
    const start = startParam
      ? parseDateStringUTC(startParam)
      : subDays(end, DEFAULT_CAJA_HISTORY_DAYS);

    const result = await cashRegisterService.emptyTrash(start, end);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logError('Error al vaciar papelera', error);
    return NextResponse.json(
      { error: 'Error al vaciar papelera' },
      { status: 500 }
    );
  }
}
