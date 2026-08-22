import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import {
  chatMessageContentSchema,
  chatPaginationQuerySchema,
} from '@/lib/zod-schemas';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

const querySchema = chatPaginationQuerySchema;

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

    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const { messages, status, total, hasMore, expiresAt, isExpired } =
      await chatService.listOperatorMessages(orderId, branchId, {
        limit: query.limit,
        before: query.before,
        after: query.after,
      });

    return NextResponse.json({
      messages,
      status,
      total,
      hasMore,
      expiresAt,
      isExpired,
    });
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

    const { searchParams } = new URL(request.url);
    const queryContent = searchParams.get('content');
    const body = await request.json().catch(() => ({}));
    const data = chatMessageContentSchema.parse({
      content: (body as { content?: string } | undefined)?.content ?? queryContent,
    });

    const message = await chatService.sendOperatorMessage(orderId, branchId, {
      content: data.content,
      senderName: session.user.name || null,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
