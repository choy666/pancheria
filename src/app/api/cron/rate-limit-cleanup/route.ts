import { NextRequest, NextResponse } from 'next/server';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : undefined;

  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const store = new DbPublicOrderRateLimitStore();
  const deleted = await store.cleanupExpired();

  return NextResponse.json({
    ok: true,
    deleted,
  });
}
