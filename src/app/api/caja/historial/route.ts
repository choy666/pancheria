import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { getDefaultCajaHistoryDays } from '@/config/caja';
import type { CashRegisterStatus } from '@/domain/types';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
    const start = startParam
      ? parseDateStringUTC(startParam)
      : subDays(end, getDefaultCajaHistoryDays());
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
  })
);
