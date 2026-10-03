import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentSchema } from '@/lib/zod-schemas';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { session, branchId }) => {
    const body = await request.json();
    const data = stockAdjustmentSchema.parse(body);
    const result = await stockService.adjustStock(
      branchId,
      data.productId,
      data.quantity,
      data.reason,
      data.type,
      session.user?.name ?? null
    );
    return NextResponse.json(result);
  })
);
