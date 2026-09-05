import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as orderService from '@/application/services/orderService';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';


export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, _context, { branchId }) => {
    const [cashRegister, stockAlerts, orderCounts] = await Promise.all([
      cashRegisterService.getOpenCashRegisterSummary(branchId),
      stockService.listStockAlerts(branchId),
      orderService.getOrderCountsByStatus(branchId),
    ]);

    const lowStockCount = stockAlerts.filter((product) => product.isLow).length;

    return NextResponse.json({
      cashRegister: cashRegister ?? { status: 'closed' as const },
      lowStockCount,
      orderCounts,
    });
  }),
  'GET /api/panel/resumen'
);

export const runtime = 'nodejs';
