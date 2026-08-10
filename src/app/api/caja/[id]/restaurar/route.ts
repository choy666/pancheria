import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withApiErrorHandling(
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
    const cashRegister = await cashRegisterService.restoreCashRegister(
      cashRegisterId
    );
    return NextResponse.json(cashRegister);
  }
);
