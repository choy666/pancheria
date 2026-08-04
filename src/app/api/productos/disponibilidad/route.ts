import { NextRequest, NextResponse } from 'next/server';
import * as saleService from '@/application/services/saleService';

export async function GET(request: NextRequest) {
  try {
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
    console.error('Error al calcular disponibilidad:', error);
    return NextResponse.json(
      { error: 'Error al calcular disponibilidad' },
      { status: 500 }
    );
  }
}
