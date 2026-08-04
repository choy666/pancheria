import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { productSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { DomainError } from '@/domain/errors';

export async function GET() {
  try {
    const products = await productService.listActiveProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error al listar productos:', error);
    return NextResponse.json(
      { error: 'Error al listar productos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = productSchema.parse(body);
    const product = await productService.createProduct(data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al crear producto:', error);
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}
