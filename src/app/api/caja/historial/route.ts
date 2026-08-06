import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
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

    const end = endParam ? new Date(endParam) : new Date();
    const start = startParam
      ? new Date(startParam)
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

    console.error('Error al listar cajas:', error);
    return NextResponse.json(
      { error: 'Error al listar cajas' },
      { status: 500 }
    );
  }
}
