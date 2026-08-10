import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withApiErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
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
  }
);

export const DELETE = withApiErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
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
  }
);
