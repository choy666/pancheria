import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { getClientIp, createPollRateLimiter } from '@/lib/rate-limit';
import {
  getPublicPollRateLimitWindowMs,
  getPublicPollRateLimitMaxRequests,
} from '@/config/rate-limit';
import { parseId } from '@/lib/id';

const querySchema = z.object({
  token: z.string().min(1),
});

// Consulta pública de estado (recent-orders-banner y flujos puntuales):
// limiter en memoria para no escribir una fila por request en la DB.
const isPollRateLimited = createPollRateLimiter(
  'pedido_poll',
  getPublicPollRateLimitWindowMs(),
  getPublicPollRateLimitMaxRequests()
);

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
        { error: 'Demasiadas consultas. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const { status, expiresAt, isExpired } = await chatService.getOrderChatStatus(
      orderId,
      query.token
    );

    return NextResponse.json({ status, expiresAt, isExpired });
  }
);

export const runtime = 'nodejs';
