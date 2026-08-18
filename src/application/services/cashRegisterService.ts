import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products, sales, cashRegisters } from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import { calculateSummaryFromSales, type SaleWithItems } from '@/application/services/summaryService';
import { addHours } from 'date-fns';
import { nowUTC } from '@/lib/date';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { AUTO_CLOSE_HOURS, AUTO_CLOSED_BY } from '@/config/caja';

/**
 * Nota sobre integridad referencial:
 * `cashRegisters.closedBy` permanece como `varchar` en lugar de FK a `users`.
 * Razones:
 *  - El cierre automatico (`autoClosed = true`) se atribuye a un valor simbolico
 *    (`AUTO_CLOSED_BY`) y no a un registro de usuario.
 *  - Convertirlo a FK requeriria un usuario "Sistema" o un campo `closedByUserId`
 *    nullable mas un indicador de cierre automatico, lo que implica migrar datos
 *    historicos y duplicar la semantica actual.
 *  - No hay un requisito de negocio que justifique el riesgo de la migracion.
 * Si en el futuro se requiere trazabilidad estricta de usuario, se evaluara
 * agregar `closedByUserId` nullable junto con `closedBy` como label.
 */
import type { CashRegisterStatus, PaginationParams } from '@/domain/types';
import {
  validatePositiveInteger,
  validateNonEmptyString,
} from '@/lib/validation-helpers';
import { fillMissingCriticalSupplies } from '@/lib/summary-helpers';
import {
  lockCashRegisterById,
  lockOpenCashRegister,
} from '@/lib/cash-register-helpers';

export async function getOpenCashRegister(branchId: number) {
  const cashRegister = await cashRegisterRepository.findOpen(branchId);

  if (!cashRegister || cashRegister.branchId !== branchId) return null;

  const now = nowUTC();
  const autoCloseAt = addHours(cashRegister.openedAt, AUTO_CLOSE_HOURS);

  if (autoCloseAt <= now) {
    return executeInTransaction(async (tx) => {
      const locked = await lockCashRegisterById(tx, branchId, cashRegister.id, {
        requireOpen: true,
        requireNotDeleted: true,
      });

      if (!locked) return null;

      const closeThreshold = addHours(locked.openedAt, AUTO_CLOSE_HOURS);
      if (closeThreshold > now) return null;

      const summary = await calculateCashRegisterSummary(branchId, locked.id, tx);

      await tx
        .update(cashRegisters)
        .set({
          status: 'closed',
          closedAt: closeThreshold,
          closedBy: AUTO_CLOSED_BY,
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

  validatePositiveInteger(branchId, 'La sucursal');
  const openedByTrimmed = validateNonEmptyString(openedBy, 'El usuario que abre la caja');

  const finalParams = { branchId, openedBy: openedByTrimmed };

  try {
    return await executeInTransaction(async (tx) => {
      const existingOpen = await lockOpenCashRegister(tx, branchId);

      if (existingOpen) {
        throw new ValidationError('Ya existe una caja abierta.');
      }

      const [result] = await tx
        .insert(cashRegisters)
        .values({
          branchId: finalParams.branchId,
          openedAt: nowUTC(),
          openedBy: finalParams.openedBy,
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

type CashRegisterSummaryInput = Pick<
  typeof cashRegisters.$inferSelect,
  'productsSummary' | 'criticalSuppliesSummary'
>;

export async function parseCashRegisterSummary(
  branchId: number,
  cashRegister: CashRegisterSummaryInput,
  shouldFillMissingCriticalSupplies = false
) {
  const productsSummary: Record<string, number> =
    cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary: Record<string, number> =
    cashRegister.criticalSuppliesSummary ?? {};

  if (shouldFillMissingCriticalSupplies) {
    const activeCriticalSupplies = await db.query.products.findMany({
      where: and(
        eq(products.branchId, branchId),
        eq(products.type, 'critical_supply'),
        eq(products.isActive, true),
        isNull(products.deletedAt)
      ),
    });

    fillMissingCriticalSupplies(criticalSuppliesSummary, activeCriticalSupplies);
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
  validatePositiveInteger(branchId, 'La sucursal');
  const closedByTrimmed = validateNonEmptyString(closedBy, 'El usuario que cierra la caja');

  return executeInTransaction(async (tx) => {
    const cashRegister = await lockCashRegisterById(tx, branchId, id, {
      requireNotDeleted: true,
    });

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
        closedBy: closedByTrimmed,
        ...summary,
      })
      .where(and(eq(cashRegisters.id, id), eq(cashRegisters.branchId, branchId)))
      .returning();

    if (!updated) {
      throw new NotFoundError('Caja', id);
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
