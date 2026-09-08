import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { session, branchId }) => {
    const body = await request.json().catch(() => ({}));
    const id = parseId(body.id);
    const userName = session.user?.name ?? 'Usuario';
    const isAdmin = session.user?.role === 'admin';
    const closeInput = {
      closingCashCount: body.closingCashCount,
      closingTransferCount: body.closingTransferCount,
      closingNotes: body.closingNotes,
      forcedCloseReason: body.forcedCloseReason,
    };

    if (!id) {
      const currentCashRegister = await cashRegisterService.getOpenCashRegister(branchId);

      if (!currentCashRegister) {
        return NextResponse.json(
          { error: 'No hay una caja abierta.' },
          { status: 400 }
        );
      }

      const cashRegister = await cashRegisterService.closeCashRegister(
        branchId,
        currentCashRegister.id,
        userName,
        closeInput,
        { isAdmin }
      );
      return NextResponse.json(cashRegister);
    }

    const cashRegister = await cashRegisterService.closeCashRegister(
      branchId,
      id,
      userName,
      closeInput,
      { isAdmin }
    );
    return NextResponse.json(cashRegister);
  })
, 'POST /api/caja/cerrar');
