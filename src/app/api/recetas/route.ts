import { NextRequest, NextResponse } from 'next/server';
import { recipeSchema } from '@/lib/zod-schemas';
import * as recipeService from '@/application/services/recipeService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const GET = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const { searchParams } = new URL(request.url);
    const productId = parseId(searchParams.get('productId'));

    if (!productId) {
      return NextResponse.json(
        { error: 'Se requiere un productId válido' },
        { status: 400 }
      );
    }

    const recipe = await recipeService.getRecipeByProductId(branchId, productId);
    return NextResponse.json(recipe);
  }, { admin: true })
);

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const body = await request.json();
    const data = recipeSchema.parse(body);
    const recipe = await recipeService.saveRecipe(
      branchId,
      data.compoundProductId,
      data.items
    );
    return NextResponse.json(recipe, { status: 201 });
  }, { admin: true })
);
