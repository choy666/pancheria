import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { DomainError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const session = await requireAuth();
    const userName = session.user?.name ?? 'Usuario';
    const cashRegister = await cashRegisterService.openCashRegister(userName);
    return NextResponse.json(cashRegister, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al abrir caja:', error);
    return NextResponse.json(
      { error: 'Error al abrir caja' },
      { status: 500 }
    );
  }
}
