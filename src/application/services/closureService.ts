import { eq, and, gte, lt, lte, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes, sales, dailyClosures } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { ValidationError } from '@/domain/errors';


function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function generateClosure(date: Date) {
  const start = startOfDay(date);
  const end = endOfDay(date);

  const existing = await db.query.dailyClosures.findFirst({
    where: eq(dailyClosures.date, start),
  });

  if (existing) {
    throw new ValidationError('Ya existe un cierre para la fecha seleccionada.');
  }

  const activeSales = await db.query.sales.findMany({
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
  });

  let cashTotal = parseMoney(0);
  let transferTotal = parseMoney(0);
  const productsSummary: Record<string, number> = {};
  const criticalSuppliesSummary: Record<string, number> = {};

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
        const recipe = await db.query.recipes.findMany({
          where: eq(recipes.compoundProductId, product.id),
          with: { supply: true },
        });

        for (const recipeItem of recipe) {
          if (!recipeItem.autoDiscount) continue;

          const consumed = recipeItem.quantity * item.quantity;
          const supplyName = recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
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

  const criticalSupplies = await db.query.products.findMany({
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

  const closure = await executeInTransaction(async (tx) => {
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

  return closure;
}

export async function getClosureByDate(date: Date) {
  const start = startOfDay(date);
  return db.query.dailyClosures.findFirst({
    where: eq(dailyClosures.date, start),
  });
}

export async function listClosures(start: Date, end: Date) {
  return db.query.dailyClosures.findMany({
    where: and(
      gte(dailyClosures.date, startOfDay(start)),
      lte(dailyClosures.date, endOfDay(end))
    ),
    orderBy: (dailyClosures, { desc }) => [desc(dailyClosures.date)],
  });
}
