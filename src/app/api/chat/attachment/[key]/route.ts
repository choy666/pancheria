import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandling } from '@/lib/api-handler';
import { readChatAttachment } from '@/lib/chat-storage';
import { getStorageProvider } from '@/config/videos';
import { auth } from '@/auth';
import * as orderRepository from '@/repositories/orderRepository';
import { UnauthorizedError } from '@/domain/errors';

function extractOrderIdFromKey(key: string): number | null {
  const parts = key.split('/');
  if (parts.length < 3) return null;
  const orderId = Number(parts[1]);
  if (Number.isNaN(orderId) || orderId <= 0) return null;
  return orderId;
}

async function canAccessAttachment(
  request: NextRequest,
  orderId: number
): Promise<boolean> {
  const session = await auth();

  if (session?.user) {
    const branchId =
      session.user.role === 'admin'
        ? undefined
        : Number(session.user.branchId);

    if (branchId === undefined) {
      return true;
    }

    const order = await orderRepository.findById(branchId, orderId);
    return order !== undefined;
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return false;

  const order = await orderRepository.findByIdWithToken(orderId, token);
  return order !== undefined;
}

export const GET = withApiErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ key: string }> }
  ) => {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);

    const provider = getStorageProvider();
    if (provider !== 'local') {
      // En proveedores remotos, la URL pública ya está en el attachment.
      // Este endpoint solo sirve como proxy/redirect de compatibilidad.
      return NextResponse.json(
        { error: 'Este adjunto no está disponible en modo local.' },
        { status: 404 }
      );
    }

    const orderId = extractOrderIdFromKey(decodedKey);
    if (!orderId) {
      return NextResponse.json(
        { error: 'Clave de adjunto inválida.' },
        { status: 400 }
      );
    }

    const canAccess = await canAccessAttachment(request, orderId);
    if (!canAccess) {
      throw new UnauthorizedError(
        'Se requiere autenticación o un token de pedido válido.'
      );
    }

    const file = await readChatAttachment(decodedKey);

    if (!file) {
      return NextResponse.json(
        { error: 'Adjunto no encontrado.' },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    });
  }
);

export const runtime = 'nodejs';
