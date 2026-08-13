import { NextRequest, NextResponse } from 'next/server';
import { cancellationSchema } from '@/lib/zod-schemas';
import * as saleService from '@/application/services/saleService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withApiErrorHandling(
  async (request: NextRequest, { params }: RouteParams) => {
    const session = await requireAuth();
    const branchId = Number(session.user.branchId);
    const { id } = await params;
    const saleId = parseId(id);
    if (!saleId) {
      return NextResponse.json(
        { error: 'ID de venta inválido.' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const { reason } = cancellationSchema.parse(body);
    const sale = await saleService.cancelSale(branchId, saleId, reason);
    return NextResponse.json(sale);
  }
);
