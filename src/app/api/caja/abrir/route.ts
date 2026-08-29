import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { session, branchId }) => {
    const body = await request.json().catch(() => ({}));
    const userName = session.user?.name ?? 'Usuario';
    const cashRegister = await cashRegisterService.openCashRegister({
      branchId,
      openedBy: userName,
      initialAmount: body.initialAmount,
    });
    return NextResponse.json(cashRegister, { status: 201 });
  })
, 'POST /api/caja/abrir');
