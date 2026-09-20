import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { chatStreamQuerySchema } from '@/lib/zod-schemas';
import { getClientIp } from '@/lib/rate-limit';
import { parseId } from '@/lib/id';
import { createChatStreamResponse } from '@/lib/chat-stream';
import { isChatPollRateLimited } from '@/lib/chat-poll-rate-limit';
import {
  getChatStreamIntervalMs,
  getChatStreamHeartbeatMs,
  getChatStreamBudgetMs,
} from '@/config/chat';

const querySchema = chatStreamQuerySchema.extend({
  token: z.string().min(1),
});

// El stream reemplaza al poll de 5 s: la conexión cuenta como un solo poll
// contra el limiter en memoria compartido con el GET (sin escrituras en DB).
const isPollRateLimited = isChatPollRateLimited;

export const GET = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const { id } = await params;
    const orderId = parseId(id);

    if (orderId === null) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (await isPollRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

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

    const scope = { token: query.token };
    const initialState = await chatService.getChatStreamState(orderId, scope);

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
        chatService.pollChatStreamTick(orderId, scope, 'operator', cursor),
    });
  }
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
