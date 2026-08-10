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

export async function listProducts(includeDeleted = false) {
  return productRepository.findAll(includeDeleted);
}

export async function getProductById(id: number, includeDeleted = false) {
  const product = await productRepository.findById(id, includeDeleted);
  if (!product) throw new NotFoundError('Producto', id);
  return product;
}

export async function listActiveProducts() {
  return productRepository.findActive();
}

export async function listActiveProductsWithAvailability() {
  const active = await listActiveProducts();
  const ids = active.map((product) => product.id);
  const availability = await saleService.calculateAvailabilityForProductIds(ids);
  return active.map((product) => ({
    ...product,
    availability: availability[product.id] ?? 0,
  }));
}

export async function createProduct(data: ProductInsert) {
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
  product.minStock = 0;

  return productRepository.create(product);
}

export async function updateProduct(id: number, data: ProductUpdate) {
  const existing = await getProductById(id);

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
      await db.delete(recipes).where(eq(recipes.compoundProductId, id));
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

  return productRepository.update(id, updateData);
}

export async function deleteProduct(id: number) {
  const product = await getProductById(id);

  if (product.type === 'compound') {
    await recipeRepository.deleteByCompoundProductId(id);
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
      'No se puede eliminar el producto porque está usado en una receta.'
    );
  }

  const usedInDeletedProduct = usedAsSupply.some(
    (recipe) => recipe.compoundProduct && recipe.compoundProduct.deletedAt
  );

  if (usedInDeletedProduct) {
    await recipeRepository.deleteBySupplyId(id);
  }

  return productRepository.softDelete(id);
}

export async function restoreProduct(id: number) {
  return productRepository.restore(id);
}

