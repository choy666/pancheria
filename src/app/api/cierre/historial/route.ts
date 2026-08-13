import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as closureService from '@/application/services/closureService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
  const start = startParam ? parseDateStringUTC(startParam) : subDays(end, 30);
  const pagination = parsePaginationParams(searchParams);

  const closures = await closureService.listClosures(
    branchId,
    start,
    end,
    pagination
  );
  return NextResponse.json(closures);
});
