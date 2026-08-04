import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recipeSchema } from '@/lib/zod-schemas';
import * as recipeService from '@/application/services/recipeService';
import { DomainError, NotFoundError, UnauthorizedError } from '@/domain/errors';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const productId = Number(searchParams.get('productId'));

    if (!productId || isNaN(productId)) {
      return NextResponse.json(
        { error: 'Se requiere productId' },
        { status: 400 }
      );
    }

    const recipe = await recipeService.getRecipeByProductId(productId);
    return NextResponse.json(recipe);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error al obtener receta:', error);
    return NextResponse.json(
      { error: 'Error al obtener receta' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = recipeSchema.parse(body);
    const recipe = await recipeService.saveRecipe(data.compoundProductId, data.items);
    return NextResponse.json(recipe, { status: 201 });
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

    console.error('Error al guardar receta:', error);
    return NextResponse.json(
      { error: 'Error al guardar receta' },
      { status: 500 }
    );
  }
}
