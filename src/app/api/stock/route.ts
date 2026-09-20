import { NextRequest, NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);

    const result = await stockService.listStockAlertsPage(
      branchId,
      pagination
    );

    return NextResponse.json(result);
  })
);
