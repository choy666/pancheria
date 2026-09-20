import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import * as productService from '@/application/services/productService';
import { nowUTC, parseDateStringUTC, startOfDayUTC, endOfDayUTC } from '@/lib/date';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import { invalidatePublicCatalogCache } from '@/lib/server-cache';

// El vaciado de papelera restaura stock y borra productos en lote: puede
// ser lento. Plan Hobby con Fluid Compute permite hasta 300 s
// (verificado 2026-09-19, Fase M del plan de escalabilidad).
export const maxDuration = 300;

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endOfDayUTC(
    endParam ? parseDateStringUTC(endParam) : nowUTC()
  );
  const start = startOfDayUTC(
    startParam ? parseDateStringUTC(startParam) : subDays(end, 30)
  );

  return { start, end };
}

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { start, end } = getDateRange(request);
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);

    const result = await productService.listDeletedProducts(
      branchId,
      start,
      end,
      pagination
    );

    return NextResponse.json(result);
  }, { admin: true })
);

export const DELETE = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { start, end } = getDateRange(request);

    const result = await productService.emptyTrash(branchId, start, end);
    invalidatePublicCatalogCache();
    return NextResponse.json(result);
  }, { admin: true })
);
