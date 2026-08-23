import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { cancellationSchema } from '@/lib/zod-schemas';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { parseId } from '@/lib/id';

export const POST = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const session = await requireAuth();
    const branchId = await getCurrentBranchId(session);
    const { id } = await params;
    const orderId = parseId(id);

    if (orderId === null) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = cancellationSchema.parse(body);

    const order = await orderService.cancelOrder(
      branchId,
      orderId,
      data.reason
    );

    return NextResponse.json({ order });
  }
);

export const runtime = 'nodejs';
