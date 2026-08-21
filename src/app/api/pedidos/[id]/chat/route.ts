import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { chatMessageContentSchema } from '@/lib/zod-schemas';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

export const GET = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
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

    const { messages, status } = await chatService.listOperatorMessages(
      orderId,
      branchId
    );

    return NextResponse.json({ messages, status });
  }
);

export const POST = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
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

    const body = await request.json();
    const data = chatMessageContentSchema.parse(body);

    const message = await chatService.sendOperatorMessage(orderId, branchId, {
      content: data.content,
      senderName: session.user.name || null,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
