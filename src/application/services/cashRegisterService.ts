import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products, sales, cashRegisters } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import { calculateSummaryFromSales, type SaleWithItems } from '@/application/services/summaryService';
import { addHours } from 'date-fns';
import { nowUTC } from '@/lib/date';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { safeJsonParse } from '@/lib/json';
import { AUTO_CLOSE_HOURS } from '@/config/caja';
import type { CashRegisterStatus, PaginationParams } from '@/domain/types';

export async function getOpenCashRegister(branchId: number) {
  const cashRegister = await cashRegisterRepository.findOpen(branchId);

  if (!cashRegister) return null;

  const now = nowUTC();
  const autoCloseAt = addHours(cashRegister.openedAt, AUTO_CLOSE_HOURS);

  if (autoCloseAt <= now) {
    return executeInTransaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(cashRegisters)
        .where(
          and(
            eq(cashRegisters.id, cashRegister.id),
            eq(cashRegisters.branchId, branchId),
            eq(cashRegisters.status, 'open'),
            isNull(cashRegisters.deletedAt)
          )
        )
        .for('update');

      if (!locked) return null;

      const closeThreshold = addHours(locked.openedAt, AUTO_CLOSE_HOURS);
      if (closeThreshold > now) return null;

      const summary = await calculateCashRegisterSummary(branchId, locked.id, tx);

      await tx
        .update(cashRegisters)
        .set({
          status: 'closed',
          closedAt: closeThreshold,
          closedBy: 'Sistema',
          autoClosed: true,
          ...summary,
        })
        .where(and(eq(cashRegisters.id, locked.id), eq(cashRegisters.branchId, branchId)));

      return null;
    });
  }

  return cashRegister;
}

function isUniqueViolationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

export async function openCashRegister(params: {
  branchId: number;
  openedBy: string;
}) {
  const { branchId, openedBy } = params;

  try {
    return await executeInTransaction(async (tx) => {
      const [existingOpen] = await tx
        .select()
        .from(cashRegisters)
        .where(
          and(
            eq(cashRegisters.branchId, branchId),
            eq(cashRegisters.status, 'open'),
            isNull(cashRegisters.deletedAt)
          )
        )
        .for('update');

      if (existingOpen) {
        throw new ValidationError('Ya existe una caja abierta.');
      }

      const [result] = await tx
        .insert(cashRegisters)
        .values({
          branchId,
          openedAt: nowUTC(),
          openedBy,
          status: 'open',
        })
        .returning();

      return result;
    });
  } catch (error) {
    if (isUniqueViolationError(error)) {
      throw new ValidationError('Ya existe una caja abierta.');
    }
    throw error;
  }
}

export async function calculateCashRegisterSummary(
  branchId: number,
  cashRegisterId: number,
  dbOrTx: typeof db = db
) {
  const activeSales = (await dbOrTx.query.sales.findMany({
    where: and(
      eq(sales.status, 'active'),
      eq(sales.branchId, branchId),
      eq(sales.cashRegisterId, cashRegisterId)
    ),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  })) as SaleWithItems[];

  return calculateSummaryFromSales(branchId, activeSales, dbOrTx);
}

type CashRegisterSummaryInput = {
  branchId: number;
  productsSummary: string | null;
  criticalSuppliesSummary: string | null;
};

export async function parseCashRegisterSummary(
  branchId: number,
  cashRegister: CashRegisterSummaryInput,
  fillMissingCriticalSupplies = false
) {
  const productsSummary = safeJsonParse<Record<string, number>>(
    cashRegister.productsSummary,
    {}
  );
  const criticalSuppliesSummary = safeJsonParse<Record<string, number>>(
    cashRegister.criticalSuppliesSummary,
    {}
  );

  if (fillMissingCriticalSupplies) {
    const activeCriticalSupplies = await db.query.products.findMany({
      where: and(
        eq(products.branchId, branchId),
        eq(products.type, 'critical_supply'),
        eq(products.isActive, true),
        isNull(products.deletedAt)
      ),
    });

    for (const supply of activeCriticalSupplies) {
      if (criticalSuppliesSummary[supply.name] === undefined) {
        criticalSuppliesSummary[supply.name] = 0;
      }
    }
  }

  return { productsSummary, criticalSuppliesSummary };
}

export async function getOpenCashRegisterSummary(branchId: number) {
  const cashRegister = await getOpenCashRegister(branchId);

  if (!cashRegister) return null;

  const summary = await parseCashRegisterSummary(branchId, cashRegister, true);

  return {
    ...cashRegister,
    ...summary,
  };
}

export async function closeCashRegister(
  branchId: number,
  id: number,
  closedBy: string
) {
  return executeInTransaction(async (tx) => {
    const [cashRegister] = await tx
      .select()
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.id, id),
          eq(cashRegisters.branchId, branchId),
          isNull(cashRegisters.deletedAt)
        )
      )
      .for('update');

    if (!cashRegister) {
      throw new NotFoundError('Caja', id);
    }

    if (cashRegister.status === 'closed') {
      throw new ValidationError('La caja ya está cerrada.');
    }

    const summary = await calculateCashRegisterSummary(branchId, id, tx);

    const [updated] = await tx
      .update(cashRegisters)
      .set({
        status: 'closed',
        closedAt: nowUTC(),
        closedBy,
        ...summary,
      })
      .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)))
      .returning();

    if (!updated) {
      throw new Error('No se pudo cerrar la caja.');
    }

    return updated;
  });
}

export async function getCurrentCashRegister(branchId: number) {
  return getOpenCashRegister(branchId);
}

export async function getCashRegisterById(
  branchId: number,
  id: number,
  includeDeleted = false
) {
  return cashRegisterRepository.findById(branchId, id, includeDeleted);
}

export async function listCashRegisterHistory(
  branchId: number,
  start: Date,
  end: Date,
  status?: CashRegisterStatus,
  pagination?: PaginationParams
) {
  return cashRegisterRepository.findInRange(
    branchId,
    start,
    end,
    status,
    pagination
  );
}

export async function deleteCashRegister(branchId: number, id: number) {
  const cashRegister = await cashRegisterRepository.findById(branchId, id);

  if (!cashRegister) {
    throw new NotFoundError('Caja', id);
  }

  if (cashRegister.status === 'open') {
    throw new ValidationError('No se puede eliminar una caja abierta.');
  }

  return cashRegisterRepository.softDelete(branchId, id);
}

export async function restoreCashRegister(branchId: number, id: number) {
  const cashRegister = await cashRegisterRepository.findById(branchId, id, true);

  if (!cashRegister || cashRegister.deletedAt === null) {
    throw new ValidationError('La caja no está eliminada.');
  }

  return cashRegisterRepository.restore(branchId, id);
}

export async function permanentlyDeleteCashRegister(branchId: number, id: number) {
  const cashRegister = await cashRegisterRepository.findById(branchId, id, true);

  if (!cashRegister || cashRegister.deletedAt === null) {
    throw new ValidationError('La caja no está en la papelera.');
  }

  return cashRegisterRepository.hardDelete(branchId, id);
}

export async function listDeletedCashRegisterHistory(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return cashRegisterRepository.findDeletedInRange(branchId, start, end, pagination);
}

export async function emptyTrash(branchId: number, start: Date, end: Date) {
  return cashRegisterRepository.hardDeleteAllDeletedInRange(branchId, start, end);
}

export async function autoCloseIfNeeded(branchId: number) {
  return getOpenCashRegister(branchId);
}
