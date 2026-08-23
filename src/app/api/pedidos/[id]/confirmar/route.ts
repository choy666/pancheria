import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderConfirmSchema } from '@/lib/zod-schemas';
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
    const data = orderConfirmSchema.parse(body);

    const sale = await orderService.convertOrderToSale({
      branchId,
      orderId,
      paymentMethod: data.paymentMethod,
      idempotencyKey: data.idempotencyKey,
    });

    return NextResponse.json({ sale }, { status: 201 });
  }
);

export const runtime = 'nodejs';
