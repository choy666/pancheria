import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as catalogService from '@/application/services/catalogService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { cartAvailabilitySchema } from '@/lib/zod-schemas';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import { getClientIp, createPollRateLimiter } from '@/lib/rate-limit';
import {
  getPublicPollRateLimitWindowMs,
  getPublicPollRateLimitMaxRequests,
} from '@/config/rate-limit';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

// Validación pública de carrito (solo lectura): veto anti-abuso en memoria,
// como los polls — no escribe filas en `public_order_rate_limits`.
const isPollRateLimited = createPollRateLimiter(
  'availability_poll',
  getPublicPollRateLimitWindowMs(),
  getPublicPollRateLimitMaxRequests()
);

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const ip = getClientIp(request);
  if (await isPollRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intentalo más tarde.' },
      { status: 429 }
    );
  }

  const branchId = query.branchId ?? (await getDefaultBranchId());

  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  const body = await request.json();
  const data = cartAvailabilitySchema.parse(body);

  const result = await catalogService.validatePublicCart(
    branchId,
    data.items,
    data.productIds
  );

  return NextResponse.json({
    availabilityByProduct: result.availabilityByProduct,
    shortageByProduct: result.shortageByProduct,
  });
});
