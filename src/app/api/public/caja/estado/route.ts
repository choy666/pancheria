import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { getCurrentOrNextOpening } from '@/lib/branch-helpers';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive(),
});

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const branch = await branchService.getBranchById(query.branchId);
  if (!branch) {
    return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 });
  }

  const cashRegister = await cashRegisterService.getOpenCashRegister(query.branchId);

  if (cashRegister) {
    return NextResponse.json({
      status: 'open',
      openingHours: getCurrentOrNextOpening(branch),
      message: 'La caja está abierta.',
    });
  }

  return NextResponse.json({
    status: 'closed',
    openingHours: getCurrentOrNextOpening(branch),
    message: `La caja está cerrada. Horario de apertura: ${getCurrentOrNextOpening(branch)}.`,
  });
}, 'GET /api/public/caja/estado');
