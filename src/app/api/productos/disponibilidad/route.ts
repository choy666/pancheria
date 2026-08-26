import { NextRequest, NextResponse } from 'next/server';
import * as saleService from '@/application/services/saleService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const productId = parseId(searchParams.get('productId'));

    if (!productId) {
      return NextResponse.json(
        { error: 'Se requiere productId' },
        { status: 400 }
      );
    }

    const availability = await saleService.calculateAvailability(branchId, productId);
    return NextResponse.json({ productId, availability });
  })
);
