import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getCronSecret } from '@/config/cron';
import * as orderService from '@/application/services/orderService';

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

  const expired = await orderService.expirePendingOrders();

  return NextResponse.json({
    ok: true,
    expired,
  });
}
