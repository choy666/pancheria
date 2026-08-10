import { NextRequest, NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const productId = parseId(searchParams.get('productId'));

  if (!productId) {
    return NextResponse.json(
      { error: 'Se requiere el ID del producto.' },
      { status: 400 }
    );
  }

  const history = await stockService.getStockHistory(productId);
  return NextResponse.json(history);
});
