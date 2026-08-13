import { NextRequest, NextResponse } from 'next/server';
import { recipeSchema } from '@/lib/zod-schemas';
import * as recipeService from '@/application/services/recipeService';
import { parseId } from '@/lib/id';
import { withApiErrorHandling } from '@/lib/api-handler';
import { requireAuth } from '@/lib/auth';

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);
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
});

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const session = await requireAuth();
  const branchId = Number(session.user.branchId);
  const body = await request.json();
  const data = recipeSchema.parse(body);
  const recipe = await recipeService.saveRecipe(
    branchId,
    data.compoundProductId,
    data.items
  );
  return NextResponse.json(recipe, { status: 201 });
});
