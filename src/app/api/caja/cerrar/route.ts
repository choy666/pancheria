import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const body = await request.json().catch(() => ({}));
  const id = parseId(body.id);

  if (!id) {
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
});
