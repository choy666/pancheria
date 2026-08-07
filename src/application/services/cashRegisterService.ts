import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes, sales, cashRegisters } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import { addHours } from 'date-fns';
import { nowUTC } from '@/lib/date';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { AUTO_CLOSE_HOURS } from '@/config/caja';
import type { CashRegisterStatus } from '@/domain/types';

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getOpenCashRegister() {
  const cashRegister = await cashRegisterRepository.findOpen();

  if (!cashRegister) return null;

  const now = nowUTC();
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
    openedAt: nowUTC(),
    openedBy,
  });
}

export async function calculateCashRegisterSummary(cashRegisterId: number) {
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

  const compoundProductIds = new Set<number>();

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

      productsSummary[product.name] =
        (productsSummary[product.name] ?? 0) + item.quantity;

      if (product.type === 'compound') {
        compoundProductIds.add(product.id);
      } else if (
        product.type === 'critical_supply' &&
        product.criticalSupplyType === 'beverage'
      ) {
        criticalSuppliesSummary[product.name] =
          (criticalSuppliesSummary[product.name] ?? 0) + item.quantity;
      }
    }
  }

  const recipesByProduct = new Map<
    number,
    {
      autoDiscount: boolean;
      quantity: number;
      supplyId: number;
      supply: { name: string } | null;
    }[]
  >();

  if (compoundProductIds.size > 0) {
    const allRecipes = await db.query.recipes.findMany({
      where: inArray(
        recipes.compoundProductId,
        Array.from(compoundProductIds)
      ),
      with: { supply: true },
    });

    for (const recipeItem of allRecipes) {
      if (!recipesByProduct.has(recipeItem.compoundProductId)) {
        recipesByProduct.set(recipeItem.compoundProductId, []);
      }
      recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
    }
  }

  for (const sale of activeSales) {
    for (const item of sale.items ?? []) {
      const product = item.product;
      if (!product || product.type !== 'compound') continue;

      const recipeList = recipesByProduct.get(product.id) ?? [];

      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount) continue;

        const consumed = recipeItem.quantity * item.quantity;
        const supplyName = recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
        criticalSuppliesSummary[supplyName] =
          (criticalSuppliesSummary[supplyName] ?? 0) + consumed;
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

export async function getOpenCashRegisterSummary() {
  const cashRegister = await getOpenCashRegister();

  if (!cashRegister) return null;

  const productsSummary = safeJsonParse<Record<string, number>>(
    cashRegister.productsSummary,
    {}
  );
  const criticalSuppliesSummary = safeJsonParse<Record<string, number>>(
    cashRegister.criticalSuppliesSummary,
    {}
  );

  const activeCriticalSupplies = await db.query.products.findMany({
    where: and(
      eq(products.type, 'critical_supply'),
      eq(products.isActive, true)
    ),
  });

  for (const supply of activeCriticalSupplies) {
    if (criticalSuppliesSummary[supply.name] === undefined) {
      criticalSuppliesSummary[supply.name] = 0;
    }
  }

  return {
    ...cashRegister,
    productsSummary,
    criticalSuppliesSummary,
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
        closedAt: nowUTC(),
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

export async function getCashRegisterById(id: number, includeDeleted = false) {
  return cashRegisterRepository.findById(id, includeDeleted);
}

export async function listCashRegisterHistory(
  start: Date,
  end: Date,
  status?: CashRegisterStatus
) {
  return cashRegisterRepository.findInRange(start, end, status);
}

export async function deleteCashRegister(id: number) {
  const cashRegister = await cashRegisterRepository.findById(id);

  if (!cashRegister) {
    throw new NotFoundError('Caja', id);
  }

  if (cashRegister.status === 'open') {
    throw new ValidationError('No se puede eliminar una caja abierta.');
  }

  return cashRegisterRepository.softDelete(id);
}

export async function restoreCashRegister(id: number) {
  const cashRegister = await cashRegisterRepository.findById(id, true);

  if (!cashRegister || cashRegister.deletedAt === null) {
    throw new ValidationError('La caja no está eliminada.');
  }

  return cashRegisterRepository.restore(id);
}

export async function permanentlyDeleteCashRegister(id: number) {
  const cashRegister = await cashRegisterRepository.findById(id, true);

  if (!cashRegister || cashRegister.deletedAt === null) {
    throw new ValidationError('La caja no está en la papelera.');
  }

  return cashRegisterRepository.hardDelete(id);
}

export async function listDeletedCashRegisterHistory(start: Date, end: Date) {
  return cashRegisterRepository.findDeletedInRange(start, end);
}

export async function emptyTrash(start: Date, end: Date) {
  return cashRegisterRepository.hardDeleteAllDeletedInRange(start, end);
}

export async function autoCloseIfNeeded() {
  return getOpenCashRegister();
}
