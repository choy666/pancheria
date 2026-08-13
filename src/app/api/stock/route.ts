import { NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

export const GET = withApiErrorHandling(async () => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
  const stock = await stockService.listStockAlerts(branchId);
  return NextResponse.json(stock);
});
