import { NextRequest, NextResponse } from 'next/server';
import * as closureService from '@/application/services/closureService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const date = dateParam ? parseDateStringUTC(dateParam) : nowUTC();

  const closure = await closureService.getClosureByDate(date);
  return NextResponse.json(closure ?? null);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const body = await request.json();
  const date = body.date ? parseDateStringUTC(body.date) : nowUTC();
  const closure = await closureService.generateClosure(date);
  return NextResponse.json(closure, { status: 201 });
});
