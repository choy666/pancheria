import { NextRequest, NextResponse } from 'next/server';
import { productSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const { searchParams } = new URL(request.url);
  const includeAvailability = searchParams.get('includeAvailability') === 'true';

  const products = includeAvailability
    ? await productService.listActiveProductsWithAvailability()
    : await productService.listActiveProducts();

  return NextResponse.json(products);
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  await requireAuth();
  const body = await request.json();
  const data = productSchema.parse(body);
  const product = await productService.createProduct(data);
  return NextResponse.json(product, { status: 201 });
});
