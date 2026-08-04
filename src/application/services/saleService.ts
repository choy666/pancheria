import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes, sales, saleItems, stockMovements } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import { isIdempotencyKeyUsed } from '@/application/idempotencyService';
import * as productRepository from '@/repositories/productRepository';
import { addMoney, multiplyMoney, moneyToNumber, parseMoney } from '@/lib/money';
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors';
import type { PaymentMethod, SaleItemInput } from '@/domain/types';

export async function calculateAvailability(productId: number): Promise<number> {
  const product = await productRepository.findById(productId);
  if (!product) return 0;

  if (product.type === 'compound') {
    const recipe = await db.query.recipes.findMany({
      where: eq(recipes.compoundProductId, productId),
      with: { supply: true },
    });

    const criticalItems = recipe.filter((r) => r.autoDiscount);
    if (criticalItems.length === 0) return 0;

    return Math.min(
      ...criticalItems.map((r) =>
        Math.floor((r.supply?.stock ?? 0) / r.quantity)
      )
    );
  }

  if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    return product.stock;
  }

  return 0;
}

export async function confirmSale(params: {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}) {
  const { items, paymentMethod, idempotencyKey } = params;

  if (await isIdempotencyKeyUsed(idempotencyKey)) {
    throw new ValidationError('La venta ya fue procesada.');
  }

  const productIds = items.map((item) => item.productId);
  const productsList = await productRepository.findByIds(productIds);

  if (productsList.length !== productIds.length) {
    throw new NotFoundError('Producto');
  }

  const productById = new Map(productsList.map((p) => [p.id, p]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new NotFoundError('Producto', item.productId);

    if (
      product.type !== 'compound' &&
      product.criticalSupplyType !== 'beverage'
    ) {
      throw new ValidationError(
        `El producto ${product.name} no está disponible para la venta.`
      );
    }

    const available = await calculateAvailability(product.id);
    if (available < item.quantity) {
      throw new InsufficientStockError(product.name, available, item.quantity);
    }
  }

  return executeInTransaction(async (tx) => {
    let saleTotal = parseMoney(0);
    const saleItemValues: {
      productId: number;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const product = productById.get(item.productId)!;
      const unitPrice = parseMoney(product.price);
      const subtotal = multiplyMoney(unitPrice, item.quantity);
      saleTotal = addMoney(saleTotal, subtotal);

      saleItemValues.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: moneyToNumber(subtotal),
      });
    }

    const [sale] = await tx
      .insert(sales)
      .values({
        total: moneyToNumber(saleTotal),
        paymentMethod,
        idempotencyKey,
      })
      .returning();

    await tx.insert(saleItems).values(
      saleItemValues.map((item) => ({
        ...item,
        saleId: sale.id,
      }))
    );

    for (const item of saleItemValues) {
      const product = productById.get(item.productId)!;

      if (product.type === 'compound') {
        const recipe = await tx.query.recipes.findMany({
          where: eq(recipes.compoundProductId, product.id),
        });

        for (const recipeItem of recipe) {
          if (!recipeItem.autoDiscount) continue;

          const consumed = recipeItem.quantity * item.quantity;

          await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${consumed}` })
            .where(eq(products.id, recipeItem.supplyId));

          await tx.insert(stockMovements).values({
            productId: recipeItem.supplyId,
            type: 'sale',
            quantity: -consumed,
            saleId: sale.id,
          });
        }
      } else if (product.criticalSupplyType === 'beverage') {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(eq(products.id, product.id));

        await tx.insert(stockMovements).values({
          productId: product.id,
          type: 'sale',
          quantity: -item.quantity,
          saleId: sale.id,
        });
      }
    }

    return sale;
  });
}

export async function cancelSale(id: number, reason: string) {
  const sale = await db.query.sales.findFirst({
    where: eq(sales.id, id),
    with: {
      items: true,
    },
  });

  if (!sale) throw new NotFoundError('Venta', id);
  if (sale.status === 'cancelled') return sale;

  return executeInTransaction(async (tx) => {
    for (const item of sale.items ?? []) {
      const product = await productRepository.findById(item.productId);
      if (!product) continue;

      if (product.type === 'compound') {
        const recipe = await tx.query.recipes.findMany({
          where: eq(recipes.compoundProductId, product.id),
        });

        for (const recipeItem of recipe) {
          if (!recipeItem.autoDiscount) continue;

          const reintegrated = recipeItem.quantity * item.quantity;

          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${reintegrated}` })
            .where(eq(products.id, recipeItem.supplyId));

          await tx.insert(stockMovements).values({
            productId: recipeItem.supplyId,
            type: 'cancellation',
            quantity: reintegrated,
            saleId: sale.id,
          });
        }
      } else if (product.criticalSupplyType === 'beverage') {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${item.quantity}` })
          .where(eq(products.id, product.id));

        await tx.insert(stockMovements).values({
          productId: product.id,
          type: 'cancellation',
          quantity: item.quantity,
          saleId: sale.id,
        });
      }
    }

    const [updated] = await tx
      .update(sales)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
      })
      .where(eq(sales.id, id))
      .returning();

    return updated;
  });
}
