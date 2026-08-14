import { createReadStream, statSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/config/videos';
import {
  getStorageProvider as getProviderInstance,
  getLocalStorageDir,
  guessMimeType,
} from '@/lib/storage';

function fileToWebStream(
  filePath: string,
  start?: number,
  end?: number
): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(
    filePath,
    start !== undefined && end !== undefined ? { start, end } : {}
  );
  let closed = false;

  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: unknown) => {
        if (closed) return;

        if (!Buffer.isBuffer(chunk)) return;

        controller.enqueue(new Uint8Array(chunk));

        if (controller.desiredSize === null || controller.desiredSize <= 0) {
          nodeStream.pause();
        }
      });

      nodeStream.on('end', () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // El controlador puede ya estar cerrado si el cliente canceló.
        }
      });

      nodeStream.on('error', (error: Error) => {
        if (closed) return;
        closed = true;
        nodeStream.destroy();
        controller.error(error);
      });
    },

    pull() {
      if (!closed) {
        nodeStream.resume();
      }
    },

    cancel() {
      if (closed) return;
      closed = true;
      nodeStream.destroy();
    },
  });
}

function parseRange(
  range: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, startStr, endStr] = match;

  if (startStr === '' && endStr === '') {
    return null;
  }

  if (startStr === '') {
    const suffix = Number.parseInt(endStr, 10);
    if (Number.isNaN(suffix) || suffix <= 0) return null;
    const start = Math.max(0, fileSize - suffix);
    return { start, end: fileSize - 1 };
  }

  const start = Number.parseInt(startStr, 10);
  if (Number.isNaN(start)) return null;

  if (start >= fileSize) return null;

  const end = endStr === '' ? fileSize - 1 : Number.parseInt(endStr, 10);
  if (Number.isNaN(end) || start > end) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}

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
      const webStream = fileToWebStream(filePath);

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
        },
      });
    }

    const parsed = parseRange(range, fileSize);

    if (!parsed) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const { start, end } = parsed;
    const chunkSize = end - start + 1;
    const webStream = fileToWebStream(filePath, start, end);

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
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
