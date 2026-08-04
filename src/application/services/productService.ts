import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import * as productRepository from '@/repositories/productRepository';
import { NotFoundError, ValidationError } from '@/domain/errors';
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

export async function createProduct(data: ProductInsert) {
  if (data.type === 'critical_supply' && !data.criticalSupplyType) {
    throw new ValidationError(
      'Los insumos críticos deben tener un tipo de insumo crítico.'
    );
  }

  if (data.type !== 'critical_supply' && data.criticalSupplyType) {
    throw new ValidationError(
      'Solo los insumos críticos pueden tener un tipo de insumo crítico.'
    );
  }

  return productRepository.create(data);
}

export async function updateProduct(id: number, data: ProductUpdate) {
  const existing = await getProductById(id);

  if (data.type === 'critical_supply' && !data.criticalSupplyType) {
    throw new ValidationError(
      'Los insumos críticos deben tener un tipo de insumo crítico.'
    );
  }

  if (data.type && data.type !== 'critical_supply' && data.criticalSupplyType) {
    throw new ValidationError(
      'Solo los insumos críticos pueden tener un tipo de insumo crítico.'
    );
  }

  if (data.type && data.type !== existing.type) {
    if (existing.type === 'compound') {
      await db.delete(recipes).where(eq(recipes.compoundProductId, id));
    }

    const usedAsSupply = await db.query.recipes.findFirst({
      where: eq(recipes.supplyId, id),
    });

    if (usedAsSupply) {
      throw new ValidationError(
        'No se puede cambiar el tipo porque el producto está usado en una receta.'
      );
    }
  }

  return productRepository.update(id, data);
}

export async function deleteProduct(id: number) {
  await getProductById(id);
  return productRepository.softDelete(id);
}

export async function restoreProduct(id: number) {
  return productRepository.restore(id);
}
