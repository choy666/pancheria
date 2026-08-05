import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const id = body.id ? Number(body.id) : undefined;

    if (!id || Number.isNaN(id)) {
      const currentCashRegister = await cashRegisterService.getOpenCashRegister();

      if (!currentCashRegister) {
        return NextResponse.json(
          { error: 'No hay una caja abierta.' },
          { status: 400 }
        );
      }

      const userName = session.user?.name ?? 'Usuario';
      const cashRegister = await cashRegisterService.closeCashRegister(
        currentCashRegister.id,
        userName
      );
      return NextResponse.json(cashRegister);
    }

    const userName = session.user?.name ?? 'Usuario';
    const cashRegister = await cashRegisterService.closeCashRegister(
      id,
      userName
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

    console.error('Error al cerrar caja:', error);
    return NextResponse.json(
      { error: 'Error al cerrar caja' },
      { status: 500 }
    );
  }
}
