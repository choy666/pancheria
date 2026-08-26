import { NextRequest, NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, _context, { branchId }) => {
    const stock = await stockService.listStockAlerts(branchId);
    return NextResponse.json(stock);
  })
);
