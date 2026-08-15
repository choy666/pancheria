import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { parsePaginationParams } from '@/lib/pagination';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth, getCurrentBranchId } from '@/lib/auth';
import type { OrderStatus } from '@/domain/types';

const querySchema = z.object({
  status: z.enum(['pending', 'converted', 'cancelled']).optional(),
});

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = await getCurrentBranchId(session);
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const pagination = parsePaginationParams(searchParams);

  const status = (query.status as OrderStatus | undefined) ?? 'pending';

  const result = await orderService.getOrders(branchId, {
    status,
    page: pagination.page,
    limit: pagination.limit,
  });

  return NextResponse.json(result);
});

export const runtime = 'nodejs';
