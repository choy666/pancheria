import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { deleteChatAttachment, saveChatAttachment } from '@/lib/chat-storage';
import { getClientIp, createRateLimiter } from '@/lib/rate-limit';
import { chatMessageContentSchema } from '@/lib/zod-schemas';
import {
  getChatRateLimitWindowMs,
  getChatRateLimitMaxRequests,
} from '@/config/chat';
import { parseId } from '@/lib/id';

const querySchema = z.object({
  token: z.string().min(1),
});

// El contenido es opcional en el upload porque el adjunto ya es suficiente;
// cuando viene, se valida con la misma regla que el endpoint de texto.
const uploadBodySchema = chatMessageContentSchema.partial();

const isRateLimited = createRateLimiter(
  'chat',
  getChatRateLimitWindowMs(),
  getChatRateLimitMaxRequests()
);

export const POST = withApiErrorHandling(
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
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const contentField = formData.get('content');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'El archivo es obligatorio.' },
        { status: 400 }
      );
    }

    const { content } = uploadBodySchema.parse({
      content: typeof contentField === 'string' ? contentField : undefined,
    });

    const attachment = await saveChatAttachment(file, orderId);

    try {
      const message = await chatService.sendClientMessage(orderId, query.token, {
        content: content ?? null,
        attachment: {
          url: attachment.publicUrl,
          key: attachment.key,
          mimeType: attachment.mimeType,
          size: attachment.size,
          name: attachment.name,
        },
      });

      return NextResponse.json({ message }, { status: 201 });
    } catch (error) {
      await deleteChatAttachment(attachment.key);
      throw error;
    }
  }
);

export const runtime = 'nodejs';
