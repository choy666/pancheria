import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { DEFAULT_CAJA_HISTORY_DAYS } from '@/config/caja';
import type { CashRegisterStatus } from '@/domain/types';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
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

  const pagination = parsePaginationParams(searchParams);
  const cashRegisters = await cashRegisterService.listCashRegisterHistory(
    branchId,
    start,
    end,
    status,
    pagination
  );
  return NextResponse.json(cashRegisters);
});
