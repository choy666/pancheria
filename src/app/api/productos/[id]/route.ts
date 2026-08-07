import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { productUpdateSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { logError } from '@/lib/logger';
import { parseId } from '@/lib/id';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logError('Error al obtener producto', error);
    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logError('Error al actualizar producto', error);
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logError('Error al eliminar producto', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}
