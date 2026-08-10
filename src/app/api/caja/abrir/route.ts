import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const POST = withApiErrorHandling(async () => {
  const session = await requireAuth();
  const userName = session.user?.name ?? 'Usuario';
  const cashRegister = await cashRegisterService.openCashRegister(userName);
  return NextResponse.json(cashRegister, { status: 201 });
});
