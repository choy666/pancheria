import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as catalogService from '@/application/services/catalogService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  includeAvailability: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .default('false')
    .transform((value) => value === 'true' || value === '1'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const branchId = query.branchId ?? (await getDefaultBranchId());

  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  const pagination =
    query.limit !== undefined || query.offset !== undefined
      ? { limit: query.limit, offset: query.offset }
      : undefined;

  const result = query.includeAvailability
    ? await catalogService.listPublicCatalogWithAvailability(branchId, pagination)
    : await catalogService.listPublicCatalog(branchId, pagination);

  return NextResponse.json(result);
});
