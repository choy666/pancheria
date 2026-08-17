import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import * as productRepository from '@/repositories/productRepository';
import * as recipeRepository from '@/repositories/recipeRepository';
import * as saleService from '@/application/services/saleService';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { productSchema, productUpdateSchema } from '@/lib/zod-schemas';
import { ZodError } from 'zod';
import type { ProductInsert, ProductUpdate } from '@/repositories/productRepository';

export async function listProducts(branchId: number, includeDeleted = false) {
  return productRepository.findAll(branchId, includeDeleted);
}

export async function getProductById(
  branchId: number,
  id: number,
  includeDeleted = false
) {
  const product = await productRepository.findById(branchId, id, includeDeleted);
  if (!product) throw new NotFoundError('Producto', id);
  return product;
}

export async function listActiveProducts(branchId: number) {
  return productRepository.findActive(branchId);
}

export async function listActiveProductsWithAvailability(branchId: number) {
  const active = await listActiveProducts(branchId);
  const ids = active.map((product) => product.id);
  const availability = await saleService.calculateAvailabilityForProductIds(
    branchId,
    ids
  );
  return active.map((product) => ({
    ...product,
    availability: availability[product.id]?.availability ?? 0,
  }));
}

export async function createProduct(branchId: number, data: ProductInsert) {
  let product;

  try {
    product = productSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues.map((e) => e.message).join('. '));
    }
    throw error;
  }

  product.stock = 0;
  if (product.type === 'compound' || product.type === 'service') {
    product.minStock = 0;
  }

  return productRepository.create({ ...product, branchId });
}

export async function updateProduct(
  branchId: number,
  id: number,
  data: ProductUpdate
) {
  const existing = await getProductById(branchId, id);

  try {
    productUpdateSchema.parse({ ...existing, ...data });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues.map((e) => e.message).join('. '));
    }
    throw error;
  }

  const updateData = { ...data };
  const effectiveType = updateData.type ?? existing.type;

  delete updateData.stock;

  if (effectiveType === 'compound' || effectiveType === 'service') {
    updateData.stock = 0;
    updateData.minStock = 0;
  }

  if (updateData.type && updateData.type !== existing.type) {
    if (existing.type === 'compound') {
      await db
        .delete(recipes)
        .where(eq(recipes.compoundProductId, id));
    }

    const usedAsSupply = await db.query.recipes.findMany({
      where: eq(recipes.supplyId, id),
      with: { compoundProduct: true },
    });

    const usedInActiveRecipe = usedAsSupply.some(
      (recipe) => recipe.compoundProduct && !recipe.compoundProduct.deletedAt
    );

    if (usedInActiveRecipe) {
      throw new ValidationError(
        'No se puede cambiar el tipo porque el producto está usado en una receta.'
      );
    }
  }

  return productRepository.update(branchId, id, updateData);
}

export async function deleteProduct(branchId: number, id: number) {
  const product = await getProductById(branchId, id);

  if (product.type === 'compound') {
    await recipeRepository.deleteByCompoundProductId(branchId, id);
  }

  const usedAsSupply = await db.query.recipes.findMany({
    where: eq(recipes.supplyId, id),
    with: { compoundProduct: true },
  });

  const activePromos = usedAsSupply
    .filter(
      (recipe) =>
        recipe.compoundProduct &&
        !recipe.compoundProduct.deletedAt &&
        recipe.compoundProduct.isActive
    )
    .map((recipe) => recipe.compoundProduct.name);

  const uniqueActivePromos = [...new Set(activePromos)];

  if (uniqueActivePromos.length > 0) {
    const promoNames = uniqueActivePromos.map((name) => `'${name}'`).join(', ');
    const message =
      uniqueActivePromos.length === 1
        ? `No se puede eliminar '${product.name}' porque forma parte de la promo activa ${promoNames}.`
        : `No se puede eliminar '${product.name}' porque forma parte de las promos activas: ${promoNames}.`;
    throw new ValidationError(message);
  }

  const hasOrphanedRecipes = usedAsSupply.some(
    (recipe) =>
      recipe.compoundProduct &&
      (recipe.compoundProduct.deletedAt || !recipe.compoundProduct.isActive)
  );

  if (hasOrphanedRecipes) {
    await recipeRepository.deleteBySupplyId(branchId, id);
  }

  return productRepository.softDelete(branchId, id);
}

export async function restoreProduct(branchId: number, id: number) {
  return productRepository.restore(branchId, id);
}
