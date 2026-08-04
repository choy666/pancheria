import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import * as recipeRepository from '@/repositories/recipeRepository';
import * as productRepository from '@/repositories/productRepository';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { RecipeItemInsert } from '@/repositories/recipeRepository';

export async function getRecipeByProductId(productId: number) {
  const product = await productRepository.findById(productId);
  if (!product || product.type !== 'compound') {
    throw new NotFoundError('Producto compuesto', productId);
  }

  return recipeRepository.findByCompoundProductId(productId);
}

export async function saveRecipe(
  compoundProductId: number,
  items: RecipeItemInsert[]
) {
  const product = await productRepository.findById(compoundProductId);
  if (!product || product.type !== 'compound') {
    throw new ValidationError('El producto debe ser de tipo compuesto.');
  }

  const hasCritical = items.some((item) => item.autoDiscount);
  if (!hasCritical) {
    throw new ValidationError(
      'La receta debe incluir al menos un insumo crítico con descuento automático.'
    );
  }

  const supplyIds = items.map((item) => item.supplyId);
  const supplies = await productRepository.findByIds(supplyIds);

  if (supplies.length !== supplyIds.length) {
    throw new ValidationError('Uno o más insumos de la receta no existen.');
  }

  for (const item of items) {
    const supply = supplies.find((s) => s.id === item.supplyId);
    if (!supply) {
      throw new ValidationError(`Insumo con ID ${item.supplyId} no encontrado.`);
    }

    if (item.autoDiscount && supply.type !== 'critical_supply') {
      throw new ValidationError(
        `El insumo ${supply.name} no es crítico y no puede tener descuento automático.`
      );
    }
  }

  return db.transaction(async (tx) => {
    await tx
      .delete(recipes)
      .where(eq(recipes.compoundProductId, compoundProductId));

    const values = items.map((item) => ({
      compoundProductId,
      supplyId: item.supplyId,
      quantity: item.quantity,
      autoDiscount: item.autoDiscount,
    }));

    return tx.insert(recipes).values(values).returning();
  });
}
