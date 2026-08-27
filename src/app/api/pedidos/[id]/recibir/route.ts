import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { parseId } from '@/lib/id';

export const POST = withApiErrorHandling(
  withAuth(async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    { branchId }
  ) => {
    const { id } = await params;
    const orderId = parseId(id);

    if (orderId === null) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const order = await orderService.receiveOrder({ branchId, orderId });

    return NextResponse.json({ order });
  })
);

export const runtime = 'nodejs';
