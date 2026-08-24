import { NextRequest, NextResponse } from 'next/server';
import { saleSchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import * as saleRepository from '@/repositories/saleRepository';
import {
  nowUTC,
  parseDateStringUTC,
  startOfDayUTC,
  endOfDayUTC,
} from '@/lib/date';
import { parseId } from '@/lib/id';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const cashRegisterIdParam = searchParams.get('cashRegisterId');
  const pagination = parsePaginationParams(searchParams);

  if (cashRegisterIdParam) {
    const cashRegisterId = parseId(cashRegisterIdParam);
    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'El ID de caja debe ser un número positivo.' },
        { status: 400 }
      );
    }
    const sales = await saleRepository.findByCashRegisterId(
      branchId,
      cashRegisterId,
      undefined,
      pagination
    );
    return NextResponse.json(sales);
  }

  const date = dateParam ? parseDateStringUTC(dateParam) : nowUTC();
  const start = startOfDayUTC(date);
  const end = endOfDayUTC(date);

  const sales = await saleRepository.findByDateRange(
    branchId,
    start,
    end,
    'active',
    pagination
  );
  return NextResponse.json(sales);
}, 'GET /api/ventas');

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
  const body = await request.json();
  const data = saleSchema.parse(body);
  const sale = await saleService.confirmSale({ branchId, ...data });
  return NextResponse.json(sale, { status: 201 });
}, 'POST /api/ventas');
