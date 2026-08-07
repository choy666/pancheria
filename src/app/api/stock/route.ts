import { NextResponse } from 'next/server';
import * as stockService from '@/application/services/stockService';
import { logError } from '@/lib/logger';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const stock = await stockService.listStockAlerts();
    return NextResponse.json(stock);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    logError('Error al obtener stock', error);
    return NextResponse.json(
      { error: 'Error al obtener stock' },
      { status: 500 }
    );
  }
}
