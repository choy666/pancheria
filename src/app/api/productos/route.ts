import { NextRequest, NextResponse } from 'next/server';
import { productSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const includeAvailability = searchParams.get('includeAvailability') === 'true';

    const products = includeAvailability
      ? await productService.listActiveProductsWithAvailability(branchId)
      : await productService.listActiveProducts(branchId);

    return NextResponse.json(products);
  })
);

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const body = await request.json();
    const data = productSchema.parse(body);
    const product = await productService.createProduct(branchId, data);
    return NextResponse.json(product, { status: 201 });
  }, { admin: true })
);
