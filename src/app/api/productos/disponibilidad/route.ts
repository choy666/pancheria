import { NextRequest, NextResponse } from 'next/server';
import * as saleService from '@/application/services/saleService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const productId = parseId(searchParams.get('productId'));

  if (!productId) {
    return NextResponse.json(
      { error: 'Se requiere productId' },
      { status: 400 }
    );
  }

  const availability = await saleService.calculateAvailability(productId);
  return NextResponse.json({ productId, availability });
});
