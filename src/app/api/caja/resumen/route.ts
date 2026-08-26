import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, _context, { branchId }) => {
    const live = await cashRegisterService.getOpenCashRegisterSummary(branchId);

    if (!live) {
      return NextResponse.json({ status: 'closed' });
    }

    return NextResponse.json(live);
  })
, 'GET /api/caja/resumen');
