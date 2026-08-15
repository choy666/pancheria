import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

export const GET = withApiErrorHandling(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAuth();
    const branchId = await getCurrentBranchId(session);
    const { id } = await params;
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
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
  }
);

export const runtime = 'nodejs';
