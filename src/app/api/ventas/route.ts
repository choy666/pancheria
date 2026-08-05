import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saleSchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import * as saleRepository from '@/repositories/saleRepository';
import { DomainError, InsufficientStockError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const cashRegisterIdParam = searchParams.get('cashRegisterId');

    if (cashRegisterIdParam) {
      const sales = await saleRepository.findByCashRegisterId(
        Number(cashRegisterIdParam),
        'active'
      );
      return NextResponse.json(sales);
    }

    const date = dateParam ? new Date(dateParam) : new Date();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const sales = await saleRepository.findByDateRange(start, end, 'active');
    return NextResponse.json(sales);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error al listar ventas:', error);
    return NextResponse.json(
      { error: 'Error al listar ventas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = saleSchema.parse(body);
    const sale = await saleService.confirmSale(data);
    return NextResponse.json(sale, { status: 201 });
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

    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al confirmar venta:', error);
    return NextResponse.json(
      { error: 'Error al confirmar venta' },
      { status: 500 }
    );
  }
}
