import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { parseId } from '@/lib/id';
import { createChatStreamResponse } from '@/lib/chat-stream';
import { chatStreamQuerySchema } from '@/lib/zod-schemas';
import {
  getChatStreamIntervalMs,
  getChatStreamHeartbeatMs,
  getChatStreamBudgetMs,
} from '@/config/chat';

export const GET = withApiErrorHandling(
  withAuth(async (
    request: NextRequest,
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

    const { searchParams } = new URL(request.url);
    const query = chatStreamQuerySchema.parse(Object.fromEntries(searchParams));

    // EventSource envía `Last-Event-ID` al reconectar; `?after=` lo usa el
    // primer connect y los clientes sin soporte de ese header.
    const lastEventId = parseId(request.headers.get('last-event-id'));
    const after = query.after ?? lastEventId ?? 0;

    const intervalMs = Math.max(
      500,
      Math.min(query.interval ?? getChatStreamIntervalMs(), 60_000)
    );
    const budgetMs = Math.max(
      500,
      Math.min(query.budget ?? getChatStreamBudgetMs(), getChatStreamBudgetMs())
    );

    const initialState = await chatService.getChatStreamState(orderId, {
      branchId,
    });

    if (!initialState) {
      return NextResponse.json(
        { error: 'Pedido no encontrado.' },
        { status: 404 }
      );
    }

    return createChatStreamResponse({
      signal: request.signal,
      after,
      intervalMs,
      heartbeatMs: getChatStreamHeartbeatMs(),
      budgetMs,
      initialState,
      fetchTick: (cursor) =>
        chatService.pollChatStreamTick(orderId, { branchId }, 'client', cursor),
    });
  })
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// El stream se cierra por `budgetMs` (default 55 s) siempre antes de este
// límite; el cliente reconecta con `Last-Event-ID`.
export const maxDuration = 60;
