import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandling } from '@/lib/api-handler';
import { readChatAttachment } from '@/lib/chat-storage';
import { getStorageProvider } from '@/config/videos';

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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }
);

export const runtime = 'nodejs';
