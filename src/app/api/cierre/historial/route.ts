import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as closureService from '@/application/services/closureService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
  const start = startParam ? parseDateStringUTC(startParam) : subDays(end, 30);

  const closures = await closureService.listClosures(start, end);
  return NextResponse.json(closures);
});
