import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as catalogService from '@/application/services/catalogService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { cartAvailabilitySchema } from '@/lib/zod-schemas';
import { getDefaultBranchId } from '@/lib/branch-resolver';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const branchId = query.branchId ?? (await getDefaultBranchId());

  const body = await request.json();
  const data = cartAvailabilitySchema.parse(body);

  const result = await catalogService.validatePublicCart(
    branchId,
    data.items,
    data.productIds
  );

  return NextResponse.json({
    availabilityByProduct: result.availabilityByProduct,
    shortageByProduct: result.shortageByProduct,
    breakdownByProduct: result.breakdownByProduct,
  });
});
