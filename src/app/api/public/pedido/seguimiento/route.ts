import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderTrackingSchema } from '@/lib/zod-schemas';

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const data = orderTrackingSchema.parse(body);

  const order = await orderService.trackOrder(
    data.orderNumber.trim(),
    data.customerName.trim()
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
