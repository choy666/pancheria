import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getCronSecret } from '@/config/cron';
import { getLoginAttemptsRetentionMs } from '@/config/rate-limit';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';
import { getRateLimitStore } from '@/lib/rate-limit-store';

// Plan Hobby con Fluid Compute permite hasta 300 s por función
// (verificado en producción 2026-09-19, Fase M del plan de escalabilidad).
export const maxDuration = 300;

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
  const deletedRateLimits = await store.cleanupExpired();
  const deletedLoginAttempts = await getRateLimitStore().cleanupStale(
    getLoginAttemptsRetentionMs()
  );

  return NextResponse.json({
    ok: true,
    deletedRateLimits,
    deletedLoginAttempts,
  });
}
