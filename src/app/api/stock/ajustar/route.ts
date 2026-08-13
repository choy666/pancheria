import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentSchema } from '@/lib/zod-schemas';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
  const body = await request.json();
  const data = stockAdjustmentSchema.parse(body);
  const result = await stockService.adjustStock(
    branchId,
    data.productId,
    data.quantity,
    data.reason,
    data.type
  );
  return NextResponse.json(result);
});
