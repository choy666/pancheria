import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderCancellationSchema } from '@/lib/zod-schemas';
import { getDefaultBranchId } from '@/lib/branch-resolver';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

export const POST = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const branchId = query.branchId ?? (await getDefaultBranchId());

    const { id } = await params;
    const orderId = Number(id);
    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }

    const body = await request.json();
    const data = orderCancellationSchema.parse(body);

    if (!data.token) {
      return NextResponse.json(
        { error: 'El token de cancelación es obligatorio.' },
        { status: 400 }
      );
    }

    const order = await orderService.cancelOrder(
      branchId,
      orderId,
      data.reason,
      data.token
    );

    return NextResponse.json({ order });
  }
);

export const runtime = 'nodejs';
