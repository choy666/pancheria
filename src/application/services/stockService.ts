import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, stockMovements } from '@/db/schema';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import { nowUTC } from '@/lib/date';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { StockMovementType } from '@/domain/types';

export async function listStockAlerts() {
  const allProducts = await productRepository.findActive();

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
  productId: number,
  quantity: number,
  reason: string,
  type: StockMovementType = 'manual_adjustment'
) {
  const product = await productRepository.findById(productId);
  if (!product) throw new NotFoundError('Producto', productId);

  if (!reason || reason.length < 3) {
    throw new ValidationError('El motivo del ajuste debe tener al menos 3 caracteres.');
  }

  const validTypes: StockMovementType[] = ['sale', 'cancellation', 'manual_adjustment', 'restock'];
  if (!validTypes.includes(type)) {
    throw new ValidationError('Tipo de movimiento de stock inválido.');
  }

  const newStock = product.stock + quantity;
  if (newStock < 0) {
    throw new ValidationError(
      `El ajuste dejaría el stock de ${product.name} en negativo.`
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, productId));

    await tx.insert(stockMovements).values({
      productId,
      type,
      quantity,
      reason,
      createdAt: nowUTC(),
    });
  });

  return { productId, newStock };
}

export async function getStockHistory(productId: number, limit = 50) {
  const product = await productRepository.findById(productId);
  if (!product) throw new NotFoundError('Producto', productId);

  return stockMovementRepository.findByProductId(productId, limit);
}
