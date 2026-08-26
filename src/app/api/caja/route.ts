import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, _context, { branchId }) => {
    const cashRegister = await cashRegisterService.getOpenCashRegister(branchId);
    return NextResponse.json(cashRegister ?? { status: 'closed' });
  })
);
