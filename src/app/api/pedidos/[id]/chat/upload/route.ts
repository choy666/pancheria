import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { saveChatAttachment } from '@/lib/chat-storage';
import { chatMessageContentSchema } from '@/lib/zod-schemas';
import { withAuth } from '@/lib/with-auth';
import { parseId } from '@/lib/id';

// El contenido es opcional en el upload porque el adjunto ya es suficiente;
// cuando viene, se valida con la misma regla que el endpoint de texto.
const uploadBodySchema = chatMessageContentSchema.partial();

export const POST = withApiErrorHandling(
  withAuth(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    { session, branchId }
  ) => {
    const { id } = await params;
    const orderId = parseId(id);

    if (orderId === null) {
      return NextResponse.json(
        { error: 'El ID de pedido debe ser un número positivo.' },
        { status: 400 }
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

    const message = await chatService.sendOperatorMessage(orderId, branchId, {
      content: content ?? null,
      attachment: {
        url: attachment.publicUrl,
        key: attachment.key,
        mimeType: attachment.mimeType,
        size: attachment.size,
        name: attachment.name,
      },
      senderName: session.user.name || null,
    });

    return NextResponse.json({ message }, { status: 201 });
  })
);

export const runtime = 'nodejs';
