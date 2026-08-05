import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes, sales, cashRegisters } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { addHours } from 'date-fns';
import { NotFoundError, ValidationError } from '@/domain/errors';

const AUTO_CLOSE_HOURS = 12;

export async function getOpenCashRegister() {
  const cashRegister = await cashRegisterRepository.findOpen();

  if (!cashRegister) return null;

  const now = new Date();
  const autoCloseAt = addHours(cashRegister.openedAt, AUTO_CLOSE_HOURS);

  if (autoCloseAt <= now) {
    const summary = await calculateCashRegisterSummary(cashRegister.id);

    await executeInTransaction(async (tx) => {
      await tx
        .update(cashRegisters)
        .set({
          status: 'closed',
          closedAt: autoCloseAt,
          closedBy: 'Sistema',
          autoClosed: true,
          ...summary,
        })
        .where(eq(cashRegisters.id, cashRegister.id));
    });

    return null;
  }

  return cashRegister;
}

export async function openCashRegister(openedBy: string) {
  const openCashRegister = await getOpenCashRegister();

  if (openCashRegister) {
    throw new ValidationError('Ya existe una caja abierta.');
  }

  return cashRegisterRepository.create({
    openedAt: new Date(),
    openedBy,
  });
}

async function calculateCashRegisterSummary(cashRegisterId: number) {
  const activeSales = await db.query.sales.findMany({
    where: and(
      eq(sales.status, 'active'),
      eq(sales.cashRegisterId, cashRegisterId)
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

  return {
    total: moneyToNumber(total),
    cashTotal: moneyToNumber(cashTotal),
    transferTotal: moneyToNumber(transferTotal),
    totalSales: activeSales.length,
    productsSummary: JSON.stringify(productsSummary),
    criticalSuppliesSummary: JSON.stringify(criticalSuppliesSummary),
  };
}

export async function closeCashRegister(id: number, closedBy: string) {
  const cashRegister = await cashRegisterRepository.findById(id);

  if (!cashRegister) {
    throw new NotFoundError('Caja', id);
  }

  if (cashRegister.status === 'closed') {
    throw new ValidationError('La caja ya está cerrada.');
  }

  const summary = await calculateCashRegisterSummary(id);

  return executeInTransaction(async (tx) => {
    const [updated] = await tx
      .update(cashRegisters)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy,
        ...summary,
      })
      .where(eq(cashRegisters.id, id))
      .returning();

    if (!updated) {
      throw new Error('No se pudo cerrar la caja.');
    }

    return updated;
  });
}

export async function getCurrentCashRegister() {
  return getOpenCashRegister();
}

export async function getCashRegisterById(id: number) {
  return cashRegisterRepository.findById(id);
}

export async function listCashRegisterHistory(start: Date, end: Date) {
  return cashRegisterRepository.findClosedInRange(start, end);
}

export async function autoCloseIfNeeded() {
  return getOpenCashRegister();
}
