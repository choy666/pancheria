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
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const cashRegisterIdParam = searchParams.get('cashRegisterId');

  if (cashRegisterIdParam) {
    const cashRegisterId = parseId(cashRegisterIdParam);
    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'El ID de caja debe ser un número positivo.' },
        { status: 400 }
      );
    }
    const sales = await saleRepository.findByCashRegisterId(
      cashRegisterId,
      'active'
    );
    return NextResponse.json(sales);
  }

  const date = dateParam ? parseDateStringUTC(dateParam) : nowUTC();
  const start = startOfDayUTC(date);
  const end = endOfDayUTC(date);

  const sales = await saleRepository.findByDateRange(start, end, 'active');
  return NextResponse.json(sales);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const body = await request.json();
  const data = saleSchema.parse(body);
  const sale = await saleService.confirmSale(data);
  return NextResponse.json(sale, { status: 201 });
});
