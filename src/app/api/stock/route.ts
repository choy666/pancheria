import { NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async () => {
  await requireAuth();
  const stock = await stockService.listStockAlerts();
  return NextResponse.json(stock);
});
