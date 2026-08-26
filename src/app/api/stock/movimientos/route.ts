import { NextRequest, NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { parseId } from '@/lib/id';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const productId = parseId(searchParams.get('productId'));

    if (!productId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del producto.' },
        { status: 400 }
      );
    }

    const pagination = parsePaginationParams(searchParams);
    const history = await stockService.getStockHistory(
      branchId,
      productId,
      pagination
    );
    return NextResponse.json(history);
  })
);
