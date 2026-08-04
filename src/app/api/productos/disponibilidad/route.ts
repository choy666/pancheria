import { NextRequest, NextResponse } from 'next/server';
import * as saleService from '@/application/services/saleService';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const productId = Number(searchParams.get('productId'));

    if (!productId || isNaN(productId)) {
      return NextResponse.json(
        { error: 'Se requiere productId' },
        { status: 400 }
      );
    }

    const availability = await saleService.calculateAvailability(productId);
    return NextResponse.json({ productId, availability });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error al calcular disponibilidad:', error);
    return NextResponse.json(
      { error: 'Error al calcular disponibilidad' },
      { status: 500 }
    );
  }
}
