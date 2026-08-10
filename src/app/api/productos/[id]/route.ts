import { NextRequest, NextResponse } from 'next/server';
import { productUpdateSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withApiErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
    await requireAuth();
    const { id } = await params;
    const productId = parseId(id);
    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto inválido.' },
        { status: 400 }
      );
    }
    const product = await productService.getProductById(productId);
    return NextResponse.json(product);
  }
);

export const PUT = withApiErrorHandling(
  async (request: NextRequest, { params }: RouteParams) => {
    await requireAuth();
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
    const product = await productService.updateProduct(productId, data);
    return NextResponse.json(product);
  }
);

export const DELETE = withApiErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
    await requireAuth();
    const { id } = await params;
    const productId = parseId(id);
    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto inválido.' },
        { status: 400 }
      );
    }
    await productService.deleteProduct(productId);
    return NextResponse.json({ success: true });
  }
);
