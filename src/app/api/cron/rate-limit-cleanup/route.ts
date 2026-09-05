import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getCronSecret } from '@/config/cron';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = getCronSecret();
  const expected = cronSecret ? `Bearer ${cronSecret}` : '';

  if (
    !expected ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const store = new DbPublicOrderRateLimitStore();
  const deleted = await store.cleanupExpired();

  return NextResponse.json({
    ok: true,
    deleted,
  });
}
