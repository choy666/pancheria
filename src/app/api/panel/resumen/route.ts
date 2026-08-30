import { NextRequest, NextResponse } from 'next/server';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as orderService from '@/application/services/orderService';
import * as stockService from '@/application/services/stockService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import type { OrderStatus } from '@/domain/types';

export const dynamic = 'force-dynamic';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'in_process',
  'paid',
  'finished',
  'cancelled',
];

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, _context, { branchId }) => {
    await orderService.expirePendingOrders(branchId);

    const [cashRegister, stockAlerts, ...orderResults] = await Promise.all([
      cashRegisterService.getOpenCashRegisterSummary(branchId),
      stockService.listStockAlerts(branchId),
      ...ORDER_STATUSES.map((status) =>
        orderService.getOrders(branchId, {
          status,
          page: 1,
          limit: 1,
        })
      ),
    ]);

    const orderCounts: Record<OrderStatus, number> = {
      pending: 0,
      in_process: 0,
      paid: 0,
      finished: 0,
      cancelled: 0,
    };

    for (let i = 0; i < ORDER_STATUSES.length; i += 1) {
      const status = ORDER_STATUSES[i];
      orderCounts[status] = orderResults[i]?.total ?? 0;
    }

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
