import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async () => {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);
  const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
  return NextResponse.json(cashRegister ?? { status: 'closed' });
});
