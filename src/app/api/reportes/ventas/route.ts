import { NextRequest, NextResponse } from 'next/server';
import { addDays, subDays } from 'date-fns';
import * as reportService from '@/application/services/reportService';
import { nowUTC, parseDateStringUTC } from '@/lib/date';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { ValidationError } from '@/domain/errors';

const DEFAULT_RANGE_DAYS = 30;

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // `end` es exclusivo para las ventas. Un `YYYY-MM-DD` se interpreta como
    // "incluir todo ese día", así que se desplaza al día siguiente.
    const endBase = endParam ? parseDateStringUTC(endParam) : nowUTC();
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endParam ?? '')
      ? addDays(endBase, 1)
      : endBase;
    const start = startParam
      ? parseDateStringUTC(startParam)
      : subDays(end, DEFAULT_RANGE_DAYS);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new ValidationError('Rango de fechas inválido.');
    }
    if (start >= end) {
      throw new ValidationError(
        'La fecha de inicio no puede ser posterior a la de fin.'
      );
    }

    const report = await reportService.getSalesReport(branchId, start, end);
    return NextResponse.json(report);
  }, { admin: true })
);
