import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAdmin, getCurrentBranchId } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const DELETE = withApiErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
    const session = await requireAdmin();
    const branchId = await getCurrentBranchId(session);
    const { id } = await params;
    const cashRegisterId = parseId(id);
    if (!cashRegisterId) {
      return NextResponse.json(
        { error: 'ID de caja inválido.' },
        { status: 400 }
      );
    }
    const result = await cashRegisterService.permanentlyDeleteCashRegister(
      branchId,
      cashRegisterId
    );
    return NextResponse.json(result);
  }
);
