import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/config/videos';
import { getStorageProvider as getProviderInstance } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = decodeURIComponent(id);

  const providerName = getStorageProvider();

  if (providerName !== 'local') {
    const provider = getProviderInstance(providerName);
    const publicUrl = provider.getPublicUrl(key);
    return NextResponse.redirect(publicUrl);
  }

  const provider = getProviderInstance('local');
  if (!provider.readFile) {
    return NextResponse.json(
      { error: 'El proveedor local no soporta lectura de archivos.' },
      { status: 500 }
    );
  }
  const file = await provider.readFile(key);

  if (!file) {
    return NextResponse.json(
      { error: 'Video no encontrado.' },
      { status: 404 }
    );
  }

  const range = request.headers.get('range');
  const { buffer, mimeType } = file;

  if (!range) {
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(buffer.length),
      },
    });
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = Number.parseInt(parts[0], 10);
  const end = parts[1]
    ? Number.parseInt(parts[1], 10)
    : buffer.length - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= buffer.length) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${buffer.length}` },
    });
  }

  const chunk = buffer.subarray(start, end + 1);
  const contentLength = chunk.length;

  return new NextResponse(new Uint8Array(chunk), {
    status: 206,
    headers: {
      'Content-Type': mimeType,
      'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(contentLength),
    },
  });
}
