import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { parseId } from '@/lib/id';

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }, { branchId }) => {
    const { id } = await params;
    const orderId = parseId(id);

    if (orderId === null) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const order = await orderService.getOrderById(branchId, orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  })
);

export const runtime = 'nodejs';
