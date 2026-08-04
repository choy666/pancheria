import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cancellationSchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import { DomainError, NotFoundError } from '@/domain/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason } = cancellationSchema.parse(body);
    const sale = await saleService.cancelSale(Number(id), reason);
    return NextResponse.json(sale);
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

    console.error('Error al anular venta:', error);
    return NextResponse.json(
      { error: 'Error al anular venta' },
      { status: 500 }
    );
  }
}
