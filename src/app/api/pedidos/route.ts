import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { expirePendingOrders } from '@/application/services/orderService';
import * as branchService from '@/application/services/branchService';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import { branchIdQueryParamSchema } from '@/lib/zod-schemas';
import { ForbiddenError, NotFoundError } from '@/domain/errors';
import type { OrderStatus } from '@/domain/types';

const querySchema = z.object({
  status: z.enum(['pending', 'converted', 'cancelled']).optional(),
  branchId: branchIdQueryParamSchema.optional(),
});

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const pagination = parsePaginationParams(searchParams);

  const status = (query.status as OrderStatus | undefined) ?? 'pending';

  const currentBranchId = await getCurrentBranchId(session);
  let branchId = currentBranchId;

  if (query.branchId !== undefined) {
    branchId = query.branchId;

    if (session.user.role === 'operator' && branchId !== currentBranchId) {
      throw new ForbiddenError(
        'No tenés permiso para ver pedidos de otra sucursal.'
      );
    }

    if (session.user.role === 'admin') {
      const branch = await branchService.getBranchById(branchId);
      if (!branch) {
        throw new NotFoundError('Sucursal', branchId);
      }
    }
  }

  await expirePendingOrders(branchId);

  const result = await orderService.getOrders(branchId, {
    status,
    page: pagination.page,
    limit: pagination.limit,
  });

  return NextResponse.json(result);
}, 'GET /api/pedidos');

export const runtime = 'nodejs';
