import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const cashRegister = await cashRegisterService.getOpenCashRegister();
    return NextResponse.json(cashRegister ?? { status: 'closed' });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error('Error al obtener caja:', error);
    return NextResponse.json(
      { error: 'Error al obtener caja' },
      { status: 500 }
    );
  }
}
