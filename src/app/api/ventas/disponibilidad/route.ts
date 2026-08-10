import { NextRequest, NextResponse } from 'next/server';
import { cartAvailabilitySchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const body = await request.json();
  const data = cartAvailabilitySchema.parse(body);
  const result = await saleService.validateCartAvailability(
    data.items,
    data.productIds
  );
  return NextResponse.json(result);
});
