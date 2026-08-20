import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { saveChatAttachment } from '@/lib/chat-storage';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';

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

    const formData = await request.formData();
    const file = formData.get('file');
    const content = formData.get('content');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'El archivo es obligatorio.' },
        { status: 400 }
      );
    }

    const attachment = await saveChatAttachment(file, orderId);

    const message = await chatService.sendOperatorMessage(orderId, branchId, {
      content: typeof content === 'string' ? content : null,
      attachment: {
        url: attachment.publicUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        name: attachment.name,
      },
      senderName: session.user.name || null,
    });

    return NextResponse.json({ message }, { status: 201 });
  }
);

export const runtime = 'nodejs';
