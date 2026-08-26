import { NextRequest, NextResponse } from 'next/server';
import * as closureService from '@/application/services/closureService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = dateParam ? parseDateStringUTC(dateParam) : nowUTC();

    const closure = await closureService.getClosureByDate(branchId, date);
    return NextResponse.json(closure ?? null);
  })
);

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const body = await request.json();
    const date = body.date ? parseDateStringUTC(body.date) : nowUTC();
    const closure = await closureService.generateClosure(branchId, date);
    return NextResponse.json(closure, { status: 201 });
  })
);
