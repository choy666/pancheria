import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
  const start = startParam
    ? parseDateStringUTC(startParam)
    : subDays(end, DEFAULT_CAJA_HISTORY_DAYS);

  return { start, end };
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { start, end } = getDateRange(request);
  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams);

  const cashRegisters = await cashRegisterService.listDeletedCashRegisterHistory(
    start,
    end,
    pagination
  );
  return NextResponse.json(cashRegisters);
});

export const DELETE = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { start, end } = getDateRange(request);

  const result = await cashRegisterService.emptyTrash(start, end);
  return NextResponse.json(result);
});
