import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { productSchema } from '@/lib/zod-schemas';
import * as productService from '@/application/services/productService';
import { logError } from '@/lib/logger';
import { isDatabaseConnectionError } from '@/lib/db-errors';
import { DomainError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Error al verificar sesión' },
      { status: 500 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const includeAvailability = searchParams.get('includeAvailability') === 'true';

    const products = includeAvailability
      ? await productService.listActiveProductsWithAvailability()
      : await productService.listActiveProducts();

    return NextResponse.json(products);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo.',
        },
        { status: 503 }
      );
    }

    logError('Error al listar productos', error);
    return NextResponse.json(
      { error: 'Error al listar productos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = productSchema.parse(body);
    const product = await productService.createProduct(data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstMessage = error.issues[0]?.message;
      return NextResponse.json(
        {
          error: firstMessage ?? 'Datos inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error:
            'No se pudo conectar a la base de datos. Verificá que el servidor de PostgreSQL esté activo.',
        },
        { status: 503 }
      );
    }

    logError('Error al crear producto', error);
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}
