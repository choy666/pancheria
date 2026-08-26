import { NextRequest, NextResponse } from 'next/server';
import { productUpdateSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withApiErrorHandling(
  withAuth(async (_request: NextRequest, { params }: RouteParams, { branchId }) => {
    const { id } = await params;
    const productId = parseId(id);
    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto inválido.' },
        { status: 400 }
      );
    }
    const product = await productService.getProductById(branchId, productId);
    return NextResponse.json(product);
  }, { admin: true })
);

export const PUT = withApiErrorHandling(
  withAuth(async (request: NextRequest, { params }: RouteParams, { branchId }) => {
    const { id } = await params;
    const productId = parseId(id);
    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto inválido.' },
        { status: 400 }
      );
    }
    const body = await request.json();
    const data = productUpdateSchema.parse(body);
    const product = await productService.updateProduct(branchId, productId, data);
    return NextResponse.json(product);
  }, { admin: true })
);

export const DELETE = withApiErrorHandling(
  withAuth(async (_request: NextRequest, { params }: RouteParams, { branchId }) => {
    const { id } = await params;
    const productId = parseId(id);
    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto inválido.' },
        { status: 400 }
      );
    }
    await productService.deleteProduct(branchId, productId);
    return NextResponse.json({ success: true });
  }, { admin: true })
);
