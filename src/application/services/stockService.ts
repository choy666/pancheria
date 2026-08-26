import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, stockMovements } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import { nowUTC } from '@/lib/date';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { PaginationParams, StockMovementType } from '@/domain/types';
import { validateMinLength } from '@/lib/validation-helpers';
import { STOCK_MOVEMENT_TYPES } from '@/lib/stock-helpers';

export async function listStockAlerts(branchId: number) {
  const allProducts = await productRepository.findActive(branchId);

  return allProducts
    .filter(
      (product) =>
        product.type === 'critical_supply' || product.type === 'manual_supply'
    )
    .map((product) => ({
      ...product,
      isLow:
        product.minStock > 0 && product.stock <= product.minStock,
    }));
}

export async function adjustStock(
  branchId: number,
  productId: number,
  quantity: number,
  reason: string,
  type: StockMovementType = 'manual_adjustment',
  dbOrTx?: typeof db
) {
  validateMinLength(reason, 3, 'El motivo del ajuste');

  if (!STOCK_MOVEMENT_TYPES.includes(type)) {
    throw new ValidationError('Tipo de movimiento de stock inválido.');
  }

  if (quantity === 0) {
    throw new ValidationError('La cantidad no puede ser cero.');
  }

  const run = async (tx: typeof db) => {
    const current = await productRepository.findByIdForUpdate(
      branchId,
      productId,
      false,
      tx
    );

    if (!current) {
      throw new NotFoundError('Producto', productId);
    }

    if (current.branchId !== branchId) {
      throw new NotFoundError('Producto', productId);
    }

    const newStock = current.stock + quantity;
    if (newStock < 0) {
      throw new ValidationError(
        `El ajuste dejaría el stock de ${current.name} en negativo.`
      );
    }

    await tx
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, productId));

    await tx.insert(stockMovements).values({
      branchId,
      productId,
      type,
      quantity,
      reason,
      createdAt: nowUTC(),
    });

    return { productId, newStock };
  };

  if (dbOrTx) {
    return run(dbOrTx);
  }

  return executeInTransaction(run);
}

export async function getStockHistory(
  branchId: number,
  productId: number,
  pagination: PaginationParams
) {
  const product = await productRepository.findById(branchId, productId);
  if (!product) throw new NotFoundError('Producto', productId);

  return stockMovementRepository.findByProductId(branchId, productId, pagination);
}
