import { NextRequest, NextResponse } from 'next/server';
import * as chatService from '@/application/services/chatService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { parseId } from '@/lib/id';
import { createRateLimiter } from '@/lib/rate-limit';
import {
  getChatBranchLocationRateLimitWindowMs,
  getChatBranchLocationRateLimitMaxRequests,
} from '@/config/chat';

const isRateLimited = createRateLimiter(
  'branch-location',
  getChatBranchLocationRateLimitWindowMs(),
  getChatBranchLocationRateLimitMaxRequests()
);

export const POST = withApiErrorHandling(
  withAuth(async (
    _request: NextRequest,
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

    if (await isRateLimited(String(branchId))) {
      return NextResponse.json(
        { error: 'Demasiadas ubicaciones enviadas. Intentalo más tarde.' },
        { status: 429 }
      );
    }

    const message = await chatService.sendBranchLocationMessage(
      orderId,
      branchId,
      session.user.name || null
    );

    return NextResponse.json({ message }, { status: 201 });
  })
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
