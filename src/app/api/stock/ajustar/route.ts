import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stockAdjustmentSchema } from '@/lib/zod-schemas';
import * as stockService from '@/application/services/stockService';
import { DomainError, NotFoundError } from '@/domain/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = stockAdjustmentSchema.parse(body);
    const result = await stockService.adjustStock(
      data.productId,
      data.quantity,
      data.reason
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al ajustar stock:', error);
    return NextResponse.json(
      { error: 'Error al ajustar stock' },
      { status: 500 }
    );
  }
}
