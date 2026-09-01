import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  recipes,
  saleItems,
  orderItems,
  saleItemRecipes,
  orderItemRecipes,
  orderStockReservations,
  stockMovements,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as productRepository from '@/repositories/productRepository';
import * as saleService from '@/application/services/saleService';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { productSchema, productUpdateSchema } from '@/lib/zod-schemas';
import {
  validateProductImageUrl,
  deleteProductImage,
} from '@/lib/product-image-storage';
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
    recipe: availability[product.id]?.recipe ?? [],
  }));
}

function normalizeImageFields(
  data: ProductInsert
): ProductInsert {
  if (data.imageUrl === '' || data.imageUrl === undefined) {
    data.imageUrl = null;
  }
  if (data.imageKey === '' || data.imageKey === undefined) {
    data.imageKey = null;
  }
  if (data.imageMimeType === '' || data.imageMimeType === undefined) {
    data.imageMimeType = null;
  }
  if (data.imageSize === undefined) {
    data.imageSize = null;
  }
  return data;
}

function validateImageUrl(product: ProductInsert): void {
  if (product.imageUrl && !product.imageKey) {
    validateProductImageUrl(product.imageUrl);
  }
}

export async function createProduct(branchId: number, data: ProductInsert) {
  let product;

  try {
    product = productSchema.parse(normalizeImageFields({ ...data }));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues.map((e) => e.message).join('. '));
    }
    throw error;
  }

  validateImageUrl(product);

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
  const updateData = { ...data };
  delete updateData.stock;

  return executeInTransaction(async (tx) => {
    const current = await productRepository.findByIdForUpdate(branchId, id, false);
    if (!current) throw new NotFoundError('Producto', id);

    try {
      productUpdateSchema.parse({
        ...current,
        ...updateData,
        imageUrl:
          updateData.imageUrl === '' || updateData.imageUrl === undefined
            ? null
            : updateData.imageUrl,
        imageKey:
          updateData.imageKey === '' || updateData.imageKey === undefined
            ? null
            : updateData.imageKey,
        imageMimeType:
          updateData.imageMimeType === '' || updateData.imageMimeType === undefined
            ? null
            : updateData.imageMimeType,
        imageSize:
          updateData.imageSize === undefined ? null : updateData.imageSize,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(error.issues.map((e) => e.message).join('. '));
      }
      throw error;
    }

    if (updateData.imageUrl && !updateData.imageKey) {
      validateProductImageUrl(updateData.imageUrl);
    }

    if (
      current.imageKey &&
      updateData.imageKey !== current.imageKey
    ) {
      await deleteProductImage(current.imageKey);
    }

    const effectiveType = updateData.type ?? current.type;

    if (effectiveType === 'compound' || effectiveType === 'service') {
      updateData.stock = 0;
      updateData.minStock = 0;
    }

    if (updateData.type && updateData.type !== current.type) {
      if (current.type === 'compound') {
        await tx.delete(recipes).where(eq(recipes.compoundProductId, id));
      }

      const usedAsSupply = await tx.query.recipes.findMany({
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
  });
}

export async function deleteProduct(branchId: number, id: number) {
  const product = await getProductById(branchId, id);

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

  return productRepository.softDelete(branchId, id);
}

export async function restoreProduct(branchId: number, id: number) {
  return productRepository.restore(branchId, id);
}

export async function permanentlyDeleteProduct(branchId: number, id: number) {
  const product = await executeInTransaction(async (tx) => {
    const current = await productRepository.findByIdForUpdate(branchId, id, true, tx);
    if (!current) throw new NotFoundError('Producto', id);

    if (!current.deletedAt) {
      throw new ValidationError(
        'El producto debe estar en la papelera para eliminarse permanentemente.'
      );
    }

    const hasSaleItems = await tx.query.saleItems.findFirst({
      where: eq(saleItems.productId, id),
    });
    const hasOrderItems = await tx.query.orderItems.findFirst({
      where: eq(orderItems.productId, id),
    });
    const hasSaleItemRecipes = await tx.query.saleItemRecipes.findFirst({
      where: eq(saleItemRecipes.supplyId, id),
    });
    const hasOrderItemRecipes = await tx.query.orderItemRecipes.findFirst({
      where: eq(orderItemRecipes.supplyId, id),
    });
    const hasStockReservations = await tx.query.orderStockReservations.findFirst({
      where: eq(orderStockReservations.productId, id),
    });
    const hasStockMovements = await tx.query.stockMovements.findFirst({
      where: eq(stockMovements.productId, id),
    });
    const hasRecipesAsSupply = await tx.query.recipes.findFirst({
      where: eq(recipes.supplyId, id),
    });

    const hasReferences =
      hasSaleItems ||
      hasOrderItems ||
      hasSaleItemRecipes ||
      hasOrderItemRecipes ||
      hasStockReservations ||
      hasStockMovements ||
      hasRecipesAsSupply;

    if (hasReferences) {
      throw new ValidationError(
        `No se puede eliminar permanentemente '${current.name}' porque tiene ventas, pedidos o movimientos asociados.`
      );
    }

    const deleted = await productRepository.hardDelete(branchId, id, tx);
    if (!deleted) throw new NotFoundError('Producto', id);

    return deleted;
  });

  if (product.imageKey) {
    await deleteProductImage(product.imageKey);
  }

  return product;
}
