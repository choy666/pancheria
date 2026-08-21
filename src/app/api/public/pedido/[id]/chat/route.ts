import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { chatMessageContentSchema } from '@/lib/zod-schemas';
import { getClientIp, createRateLimiter } from '@/lib/rate-limit';
import {
  getChatRateLimitWindowMs,
  getChatRateLimitMaxRequests,
} from '@/config/chat';

const querySchema = z.object({
  token: z.string().min(1),
});

const isRateLimited = createRateLimiter(
  'chat',
  getChatRateLimitWindowMs(),
  getChatRateLimitMaxRequests()
);

export const GET = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const { id } = await params;
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const { messages, status } = await chatService.listClientMessages(
      orderId,
      query.token
    );

    return NextResponse.json({ messages, status });
  }
);

export const POST = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));
    const { id } = await params;
    const orderId = Number(id);

    if (Number.isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const data = chatMessageContentSchema.parse(body);

    const message = await chatService.sendClientMessage(orderId, query.token, {
      content: data.content,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
