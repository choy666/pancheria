import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAuth();
    const { id } = await params;
    const cashRegister = await cashRegisterService.getCashRegisterById(
      Number(id)
    );

    if (!cashRegister) {
      return NextResponse.json(
        { error: 'Caja no encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json(cashRegister);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error al obtener caja:', error);
    return NextResponse.json(
      { error: 'Error al obtener caja' },
      { status: 500 }
    );
  }
}
