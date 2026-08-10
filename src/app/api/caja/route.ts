import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async () => {
  await requireAuth();
  const cashRegister = await cashRegisterService.getOpenCashRegister();
  return NextResponse.json(cashRegister ?? { status: 'closed' });
});
