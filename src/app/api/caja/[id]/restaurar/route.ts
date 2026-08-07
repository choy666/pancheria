import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { logError } from '@/lib/logger';
import { parseId } from '@/lib/id';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
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
    const cashRegister = await cashRegisterService.restoreCashRegister(
      cashRegisterId
    );
    return NextResponse.json(cashRegister);
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

    logError('Error al restaurar caja', error);
    return NextResponse.json(
      { error: 'Error al restaurar caja' },
      { status: 500 }
    );
  }
}
