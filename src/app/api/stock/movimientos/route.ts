import { NextRequest, NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { logError } from '@/lib/logger';
import { parseId } from '@/lib/id';
import { NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logError('Error al obtener historial de stock', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de stock' },
      { status: 500 }
    );
  }
}
