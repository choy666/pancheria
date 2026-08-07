import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cancellationSchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import { logError } from '@/lib/logger';
import { parseId } from '@/lib/id';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const saleId = parseId(id);
    if (!saleId) {
      return NextResponse.json(
        { error: 'ID de venta inválido.' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { reason } = cancellationSchema.parse(body);
    const sale = await saleService.cancelSale(saleId, reason);
    return NextResponse.json(sale);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

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

    logError('Error al anular venta', error);
    return NextResponse.json(
      { error: 'Error al anular venta' },
      { status: 500 }
    );
  }
}
