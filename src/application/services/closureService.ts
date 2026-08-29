import { eq, and, gte, lt, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products, sales, cashRegisters, dailyClosures } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as dailyClosureRepository from '@/repositories/dailyClosureRepository';
import { calculateSummaryFromSales, type SaleWithItems } from '@/application/services/summaryService';
import { startOfDayUTC, endOfDayUTC, nowUTC } from '@/lib/date';
import { ValidationError } from '@/domain/errors';
import type { PaginationParams, RecipeItemConfig } from '@/domain/types';

export async function generateClosure(branchId: number, date: Date) {
  const start = startOfDayUTC(date);
  const end = endOfDayUTC(date);

  if (start > nowUTC()) {
    throw new ValidationError('No se puede generar un cierre para una fecha futura.');
  }

  return executeInTransaction(async (tx) => {
    const existing = await tx.query.dailyClosures.findFirst({
      where: and(
        eq(dailyClosures.branchId, branchId),
        eq(dailyClosures.date, start)
      ),
    });

    if (existing) {
      throw new ValidationError('Ya existe un cierre para la fecha seleccionada.');
    }

    const openRegistersWithSales = await tx.query.cashRegisters.findMany({
      where: and(
        eq(cashRegisters.branchId, branchId),
        eq(cashRegisters.status, 'open'),
        isNull(cashRegisters.deletedAt)
      ),
      with: {
        sales: {
          where: and(
            eq(sales.status, 'active'),
            gte(sales.createdAt, start),
            lt(sales.createdAt, end)
          ),
        },
      },
    });

    if (openRegistersWithSales.some((register) => (register.sales ?? []).length > 0)) {
      throw new ValidationError(
        'No se puede generar el cierre porque hay cajas abiertas con ventas de esta fecha. Cerrá las cajas primero.'
      );
    }

    const salesInRange = (await tx.query.sales.findMany({
      where: and(
        eq(sales.branchId, branchId),
        eq(sales.status, 'active'),
        isNotNull(sales.cashRegisterId),
        gte(sales.createdAt, start),
        lt(sales.createdAt, end)
      ),
      with: {
        items: {
          with: {
            product: true,
            recipeSnapshots: true,
          },
        },
        payments: true,
        cashRegister: true,
      },
    })) as {
      total: number;
      paymentMethod?: 'cash' | 'transfer';
      payments?: { method: 'cash' | 'transfer'; amount: number }[];
      cashRegister: { deletedAt: Date | null } | null;
      items: {
        quantity: number;
        product: typeof products.$inferSelect | null;
        recipeSnapshots: RecipeItemConfig[];
      }[];
    }[];

    const activeSales: SaleWithItems[] = salesInRange
      .filter((sale) => sale.cashRegister?.deletedAt === null)
      .map((sale) => ({
        ...sale,
        items: sale.items.map((item) => ({
          ...item,
          recipeSnapshot: item.recipeSnapshots as unknown as RecipeItemConfig[],
        })),
      }));

    const summary = await calculateSummaryFromSales(branchId, activeSales, tx);

    const [result] = await tx
      .insert(dailyClosures)
      .values({
        branchId,
        date: start,
        ...summary,
      })
      .returning();

    if (!result) {
      throw new Error('No se pudo generar el cierre diario.');
    }

    return result;
  });
}

export async function getClosureByDate(branchId: number, date: Date) {
  const start = startOfDayUTC(date);
  return db.query.dailyClosures.findFirst({
    where: and(
      eq(dailyClosures.branchId, branchId),
      eq(dailyClosures.date, start)
    ),
  });
}

export async function listClosures(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return dailyClosureRepository.findByDateRange(
    branchId,
    startOfDayUTC(start),
    endOfDayUTC(end),
    pagination
  );
}
