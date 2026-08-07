import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as closureService from '@/application/services/closureService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { logError } from '@/lib/logger';
import { UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const end = endParam ? parseDateStringUTC(endParam) : nowUTC();
    const start = startParam ? parseDateStringUTC(startParam) : subDays(end, 30);

    const closures = await closureService.listClosures(start, end);
    return NextResponse.json(closures);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    logError('Error al listar cierres', error);
    return NextResponse.json(
      { error: 'Error al listar cierres' },
      { status: 500 }
    );
  }
}
