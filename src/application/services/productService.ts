import { db } from '@/db';
import { executeInTransaction } from '@/application/transactionService';
import * as productRepository from '@/repositories/productRepository';
import * as recipeRepository from '@/repositories/recipeRepository';
import * as saleService from '@/application/services/saleService';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { productSchema, productUpdateSchema } from '@/lib/zod-schemas';
import {
  validateProductImageUrl,
  deleteProductImage,
} from '@/lib/product-image-storage';
import { ZodError } from 'zod';
import type { ProductInsert, ProductUpdate } from '@/repositories/productRepository';
import type { PaginationParams } from '@/domain/types';

export async function listProducts(branchId: number, includeDeleted = false) {
  return productRepository.findAll(branchId, includeDeleted);
}

export async function listDeletedProducts(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return productRepository.findDeletedInRange(branchId, start, end, pagination);
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

  let previousImageKey: string | null = null;
  let shouldDeletePreviousImage = false;

  const updated = await executeInTransaction(async (tx) => {
    const current = await productRepository.findByIdForUpdate(branchId, id, false, tx);
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

    previousImageKey = current.imageKey ?? null;
    shouldDeletePreviousImage =
      !!previousImageKey && updateData.imageKey !== previousImageKey;

    const effectiveType = updateData.type ?? current.type;

    if (effectiveType === 'compound' || effectiveType === 'service') {
      updateData.stock = 0;
      updateData.minStock = 0;
    }

    if (updateData.type && updateData.type !== current.type) {
      if (current.type === 'compound') {
        await recipeRepository.deleteByCompoundProductId(tx, id);
      }

      const usedAsSupply = await recipeRepository.findBySupplyId(tx, id);

      const usedInActiveRecipe = usedAsSupply.some(
        (recipe) => recipe.compoundProduct && !recipe.compoundProduct.deletedAt
      );

      if (usedInActiveRecipe) {
        throw new ValidationError(
          'No se puede cambiar el tipo porque el producto está usado en una receta.'
        );
      }
    }

    return productRepository.update(branchId, id, updateData, tx);
  });

  if (shouldDeletePreviousImage && previousImageKey) {
    await deleteProductImage(previousImageKey);
  }

  return updated;
}

export async function deleteProduct(branchId: number, id: number) {
  const product = await getProductById(branchId, id);

  const usedAsSupply = await recipeRepository.findBySupplyId(db, id);

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

    const referencedIds = await productRepository.findReferencedProductIds(tx, [
      id,
    ]);

    if (referencedIds.has(id)) {
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

const EMPTY_TRASH_BATCH_SIZE = 100;

export async function emptyTrash(
  branchId: number,
  start: Date,
  end: Date
): Promise<{ deleted: number; skipped: Array<{ id: number; name: string }> }> {
  let deleted = 0;
  let skipped: Array<{ id: number; name: string }> = [];
  let page = 1;

  for (;;) {
    const { items: deletedProducts } = await productRepository.findDeletedInRange(
      branchId,
      start,
      end,
      { page, limit: EMPTY_TRASH_BATCH_SIZE }
    );

    if (deletedProducts.length === 0) break;

    const productIds = deletedProducts.map((product) => product.id);
    const imageKeysToDelete: string[] = [];

    const result = await executeInTransaction(async (tx) => {
      const referencedIds = await productRepository.findReferencedProductIds(
        tx,
        productIds
      );

      const deletableProducts = deletedProducts.filter(
        (product) => !referencedIds.has(product.id)
      );

      const batchSkipped = deletedProducts
        .filter((product) => referencedIds.has(product.id))
        .map((product) => ({ id: product.id, name: product.name }));

      if (deletableProducts.length === 0) {
        return { deleted: 0, skipped: batchSkipped, imageKeys: [] };
      }

      const deletableIds = deletableProducts.map((product) => product.id);
      const deletedRows = await productRepository.hardDeleteMany(
        branchId,
        deletableIds,
        tx
      );

      const keys = deletedRows
        .map((row) => row.imageKey)
        .filter((key): key is string => !!key);

      return {
        deleted: deletedRows.length,
        skipped: batchSkipped,
        imageKeys: keys,
      };
    });

    deleted += result.deleted;
    skipped = skipped.concat(result.skipped);
    imageKeysToDelete.push(...result.imageKeys);

    for (const imageKey of imageKeysToDelete) {
      await deleteProductImage(imageKey);
    }

    if (deletedProducts.length < EMPTY_TRASH_BATCH_SIZE) break;
    page++;
  }

  return { deleted, skipped };
}
