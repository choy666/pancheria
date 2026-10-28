import { NextResponse } from 'next/server';
import * as brandService from '@/application/services/brandService';
import { withApiErrorHandling } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async () => {
  const logo = await brandService.getBrandLogo();

  if (!logo) {
    return NextResponse.json({ error: 'Logo no encontrado.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(logo.data), {
    headers: {
      'Content-Type': logo.mimeType,
      'Cache-Control': 'public, max-age=86400, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export const runtime = 'nodejs';
