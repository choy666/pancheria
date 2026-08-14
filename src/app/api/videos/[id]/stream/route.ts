import { createReadStream, statSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/config/videos';
import { getStorageProvider as getProviderInstance, getLocalStorageDir, guessMimeType } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = decodeURIComponent(id);

  const providerName = getStorageProvider();

  if (providerName !== 'local') {
    const provider = getProviderInstance(providerName);
    return NextResponse.redirect(provider.getPublicUrl(key));
  }

  const filePath = path.join(getLocalStorageDir(), key);

  try {
    const stats = statSync(filePath);
    const fileSize = stats.size;
    const mimeType = guessMimeType(key);

    const range = request.headers.get('range');

    if (!range) {
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream);

      return new NextResponse(webStream as unknown as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
        },
      });
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1]
      ? Number.parseInt(parts[1], 10)
      : fileSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= fileSize
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const clampedEnd = Math.min(end, fileSize - 1);
    const chunkSize = clampedEnd - start + 1;
    const nodeStream = createReadStream(filePath, {
      start,
      end: clampedEnd,
    });
    const webStream = Readable.toWeb(nodeStream);

    return new NextResponse(webStream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${start}-${clampedEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Video no encontrado.' },
      { status: 404 }
    );
  }
}
