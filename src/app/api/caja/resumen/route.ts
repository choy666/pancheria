import { NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async () => {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);

  const live = await cashRegisterService.getOpenCashRegisterSummary(branchId);

  if (!live) {
    return NextResponse.json({ status: 'closed' });
  }

  return NextResponse.json(live);
});
