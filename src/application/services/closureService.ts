import { eq, and, gte, lt, lte, isNotNull, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes, sales, dailyClosures } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { startOfDayUTC, endOfDayUTC } from '@/lib/date';
import { ValidationError } from '@/domain/errors';

type RecipeWithSupply = typeof recipes.$inferSelect & {
  supply: typeof products.$inferSelect | null;
};

export async function generateClosure(date: Date) {
  const start = startOfDayUTC(date);
  const end = endOfDayUTC(date);

  return executeInTransaction(async (tx) => {
    const existing = await tx.query.dailyClosures.findFirst({
      where: eq(dailyClosures.date, start),
    });

    if (existing) {
      throw new ValidationError('Ya existe un cierre para la fecha seleccionada.');
    }

    const activeSales = (await tx.query.sales.findMany({
      where: and(
        eq(sales.status, 'active'),
        isNotNull(sales.cashRegisterId),
        gte(sales.createdAt, start),
        lt(sales.createdAt, end)
      ),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      },
    })) as {
      total: number;
      paymentMethod: 'cash' | 'transfer';
      items: {
        quantity: number;
        product: typeof products.$inferSelect | null;
      }[];
    }[];

    let cashTotal = parseMoney(0);
    let transferTotal = parseMoney(0);
    const productsSummary: Record<string, number> = {};
    const criticalSuppliesSummary: Record<string, number> = {};

    const compoundProductIds = new Set<number>();
    for (const sale of activeSales) {
      for (const item of sale.items ?? []) {
        if (item.product?.type === 'compound') {
          compoundProductIds.add(item.product.id);
        }
      }
    }

    const recipesByProduct = new Map<number, RecipeWithSupply[]>();
    if (compoundProductIds.size > 0) {
      const allRecipes = (await tx.query.recipes.findMany({
        where: inArray(recipes.compoundProductId, Array.from(compoundProductIds)),
        with: { supply: true },
      })) as RecipeWithSupply[];

      for (const recipeItem of allRecipes) {
        if (!recipesByProduct.has(recipeItem.compoundProductId)) {
          recipesByProduct.set(recipeItem.compoundProductId, []);
        }
        recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
      }
    }

    for (const sale of activeSales) {
      const saleTotal = parseMoney(sale.total);
      if (sale.paymentMethod === 'cash') {
        cashTotal = addMoney(cashTotal, saleTotal);
      } else {
        transferTotal = addMoney(transferTotal, saleTotal);
      }

      for (const item of sale.items ?? []) {
        const product = item.product;
        if (!product) continue;

        const key = product.name;
        productsSummary[key] = (productsSummary[key] ?? 0) + item.quantity;

        if (product.type === 'compound') {
          const recipeList = recipesByProduct.get(product.id) ?? [];

          for (const recipeItem of recipeList) {
            if (!recipeItem.autoDiscount) continue;

            const consumed = recipeItem.quantity * item.quantity;
            const supplyName =
              recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
            criticalSuppliesSummary[supplyName] =
              (criticalSuppliesSummary[supplyName] ?? 0) + consumed;
          }
        } else if (
          product.type === 'critical_supply' &&
          product.criticalSupplyType === 'beverage'
        ) {
          criticalSuppliesSummary[key] =
            (criticalSuppliesSummary[key] ?? 0) + item.quantity;
        }
      }
    }

    const total = addMoney(cashTotal, transferTotal);

    const criticalSupplies = await tx.query.products.findMany({
      where: and(
        eq(products.type, 'critical_supply'),
        eq(products.isActive, true)
      ),
    });

    for (const supply of criticalSupplies) {
      const key = supply.name;
      if (criticalSuppliesSummary[key] === undefined) {
        criticalSuppliesSummary[key] = 0;
      }
    }

    const [result] = await tx
      .insert(dailyClosures)
      .values({
        date: start,
        total: moneyToNumber(total),
        cashTotal: moneyToNumber(cashTotal),
        transferTotal: moneyToNumber(transferTotal),
        totalSales: activeSales.length,
        productsSummary: JSON.stringify(productsSummary),
        criticalSuppliesSummary: JSON.stringify(criticalSuppliesSummary),
      })
      .returning();

    if (!result) {
      throw new Error('No se pudo generar el cierre diario.');
    }

    return result;
  });
}

export async function getClosureByDate(date: Date) {
  const start = startOfDayUTC(date);
  return db.query.dailyClosures.findFirst({
    where: eq(dailyClosures.date, start),
  });
}

export async function listClosures(start: Date, end: Date) {
  return db.query.dailyClosures.findMany({
    where: and(
      gte(dailyClosures.date, startOfDayUTC(start)),
      lte(dailyClosures.date, endOfDayUTC(end))
    ),
    orderBy: (dailyClosures, { desc }) => [desc(dailyClosures.date)],
  });
}
