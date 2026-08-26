import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
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

    await chatService.markOperatorMessagesAsRead(orderId, branchId);

    return NextResponse.json({ ok: true });
  })
);

export const runtime = 'nodejs';
