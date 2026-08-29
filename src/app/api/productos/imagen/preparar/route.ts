import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import * as productRepository from '@/repositories/productRepository';
import {
  prepareProductImageUpload,
  validateProductImage,
} from '@/lib/product-image-storage';
import type { ProductImageFileInfo } from '@/lib/product-image-storage';

const prepareSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  size: z.coerce.number().int().nonnegative(),
});

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const body = await request.json();
    const data = prepareSchema.parse(body);

    const product = await productRepository.findById(
      branchId,
      data.productId,
      false
    );

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado.' },
        { status: 404 }
      );
    }

    const fileInfo: ProductImageFileInfo = {
      name: data.name,
      type: data.type,
      size: data.size,
    };

    validateProductImage(fileInfo);

    const instructions = await prepareProductImageUpload(
      fileInfo,
      data.productId
    );

    return NextResponse.json(instructions);
  }, { admin: true })
);
