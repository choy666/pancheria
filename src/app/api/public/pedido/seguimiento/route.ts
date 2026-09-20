import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderTrackingSchema } from '@/lib/zod-schemas';
import { getClientIp, createRateLimiter } from '@/lib/rate-limit';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import {
  getOrderRateLimitWindowMs,
  getOrderRateLimitMaxRequests,
} from '@/config/orders';

const isRateLimited = createRateLimiter(
  'order-tracking',
  getOrderRateLimitWindowMs(),
  getOrderRateLimitMaxRequests()
);

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const ip = getClientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intentalo más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const data = orderTrackingSchema.parse(body);

  // El orderNumber solo es único por sucursal: sin scope el lookup podría
  // resolver pedidos de otra sucursal que comparta numeración.
  const branchId = data.branchId ?? (await getDefaultBranchId());
  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  const order = await orderService.trackOrder(
    branchId,
    data.orderNumber.trim(),
    data.customerName?.trim(),
    data.customerPhone?.trim()
  );

  if (!order) {
    return NextResponse.json(
      { error: 'No se encontró el pedido. Verificá el número y el nombre.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ order });
});

export const runtime = 'nodejs';
