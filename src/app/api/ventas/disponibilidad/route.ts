import { NextRequest, NextResponse } from 'next/server';
import { cartAvailabilitySchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const body = await request.json();
    const data = cartAvailabilitySchema.parse(body);
    const result = await saleService.validateCartAvailability(
      branchId,
      data.items,
      data.productIds
    );
    return NextResponse.json(result);
  })
);
