import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as catalogService from '@/application/services/catalogService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { getDefaultBranchId } from '@/lib/branch-resolver';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
  includeAvailability: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .default('false')
    .transform((value) => value === 'true' || value === '1'),
});

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const branchId = query.branchId ?? (await getDefaultBranchId());

  const products = query.includeAvailability
    ? await catalogService.listPublicCatalogWithAvailability(branchId)
    : await catalogService.listPublicCatalog(branchId);

  return NextResponse.json(products);
});
