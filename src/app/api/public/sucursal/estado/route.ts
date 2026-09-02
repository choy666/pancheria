import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { withApiErrorHandling } from '@/lib/api-handler';
import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';

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
  const open = cashRegister !== null && isBranchOpen(branch);

  const currentOpening = getTodayOpening(branch);
  const nextOpening = getNextOpening(branch);

  const message = open
    ? `Sucursal abierta. ${currentOpening}.`
    : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;

  return NextResponse.json({
    isOpen: open,
    currentOpening,
    nextOpening,
    branch: {
      id: branch.id,
      name: branch.name,
      openingHours: branch.openingHours,
      address: branch.address ?? null,
      phone: branch.phone ?? null,
      location: branch.location ?? null,
    },
    message,
  });
}, 'GET /api/public/sucursal/estado');
