import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { logError } from '@/lib/logger';
import { parseId } from '@/lib/id';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
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
    const cashRegisterId = parseId(id);
    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'ID de caja inválido.' },
        { status: 400 }
      );
    }
    const cashRegister = await cashRegisterService.getCashRegisterById(
      cashRegisterId,
      true
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

    logError('Error al obtener caja', error);
    return NextResponse.json(
      { error: 'Error al obtener caja' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAuth();
    const { id } = await params;
    const cashRegisterId = parseId(id);
    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'ID de caja inválido.' },
        { status: 400 }
      );
    }
    await cashRegisterService.deleteCashRegister(cashRegisterId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logError('Error al eliminar caja', error);
    return NextResponse.json(
      { error: 'Error al eliminar caja' },
      { status: 500 }
    );
  }
}
