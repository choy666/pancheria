import { db } from '@/db';
import { executeInTransaction } from '@/application/transactionService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import * as productRepository from '@/repositories/productRepository';
import * as saleRepository from '@/repositories/saleRepository';
import { calculateSummaryFromSales, type SaleWithItems } from '@/application/services/summaryService';
import { addHours } from 'date-fns';
import { nowUTC } from '@/lib/date';
import { parseMoney, moneyToNumber, addMoney, subtractMoney } from '@/lib/money';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { getAutoCloseHours, getAutoClosedBy } from '@/config/caja';

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
import type {
  CashRegisterStatus,
  PaginationParams,
  RecipeItemConfig,
} from '@/domain/types';
import {
  validatePositiveInteger,
  validateNonEmptyString,
  validateNonNegativeMoney,
} from '@/lib/validation-helpers';
import { fillMissingCriticalSupplies } from '@/lib/summary-helpers';
import {
  lockCashRegisterById,
  lockOpenCashRegister,
} from '@/lib/cash-register-helpers';
import { buildProductContext } from '@/lib/product-helpers';
import { reintegrateStockForItems } from '@/lib/stock-helpers';

export async function getOpenCashRegister(branchId: number) {
  const cashRegister = await cashRegisterRepository.findOpen(branchId);

  if (!cashRegister || cashRegister.branchId !== branchId) return null;

  const now = nowUTC();
  const autoCloseAt = addHours(cashRegister.openedAt, getAutoCloseHours());

  if (autoCloseAt <= now) {
    return executeInTransaction(async (tx) => {
      const locked = await lockCashRegisterById(tx, branchId, cashRegister.id, {
        requireOpen: true,
        requireNotDeleted: true,
      });

      if (!locked) return null;

      const closeThreshold = addHours(locked.openedAt, getAutoCloseHours());
      if (closeThreshold > now) return null;

      const summary = await calculateCashRegisterSummary(branchId, locked.id, tx);

      await cashRegisterRepository.update(
        branchId,
        locked.id,
        {
          status: 'closed',
          closedAt: nowUTC(),
          closedBy: getAutoClosedBy(),
          autoClosed: true,
          ...summary,
        } as Partial<cashRegisterRepository.CashRegisterRow>,
        tx
      );

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
  initialAmount?: unknown;
}) {
  const { branchId, openedBy, initialAmount } = params;

  validatePositiveInteger(branchId, 'La sucursal');
  const openedByTrimmed = validateNonEmptyString(openedBy, 'El usuario que abre la caja');
  const initialAmountValue = validateNonNegativeMoney(initialAmount, 'El monto inicial');

  const finalParams = { branchId, openedBy: openedByTrimmed, initialAmount: initialAmountValue };

  try {
    return await executeInTransaction(async (tx) => {
      const existingOpen = await lockOpenCashRegister(tx, branchId);

      if (existingOpen) {
        throw new ValidationError('Ya existe una caja abierta.');
      }

      return cashRegisterRepository.create(
        {
          branchId: finalParams.branchId,
          openedAt: nowUTC(),
          openedBy: finalParams.openedBy,
          initialAmount: finalParams.initialAmount,
        },
        tx
      );
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
  const activeSales = (await saleRepository.findActiveWithDetailsByCashRegister(
    dbOrTx,
    branchId,
    cashRegisterId
  )) as SaleWithItems[];

  const salesWithSnapshot: SaleWithItems[] = activeSales.map((sale) => ({
    ...sale,
    items: sale.items.map((item) => ({
      ...item,
      recipeSnapshot: (item as { recipeSnapshots?: RecipeItemConfig[] }).recipeSnapshots,
    })),
  }));

  return calculateSummaryFromSales(branchId, salesWithSnapshot, dbOrTx);
}

type CashRegisterSummaryInput = Pick<
  cashRegisterRepository.CashRegisterRow,
  'productsSummary' | 'criticalSuppliesSummary' | 'recipeSuppliesSummary'
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
  const recipeSuppliesSummary: Record<string, number> =
    cashRegister.recipeSuppliesSummary ?? {};

  if (shouldFillMissingCriticalSupplies) {
    const activeCriticalSupplies =
      await productRepository.findActiveCriticalSupplies(branchId);

    fillMissingCriticalSupplies(criticalSuppliesSummary, activeCriticalSupplies);
  }

  return { productsSummary, criticalSuppliesSummary, recipeSuppliesSummary };
}

export async function getOpenCashRegisterSummary(branchId: number) {
  const cashRegister = await getOpenCashRegister(branchId);

  if (!cashRegister) return null;

  const summary = await parseCashRegisterSummary(branchId, cashRegister, true);

  const cashInDrawer = moneyToNumber(
    addMoney(parseMoney(cashRegister.initialAmount ?? 0), parseMoney(cashRegister.cashTotal ?? 0))
  );

  return {
    ...cashRegister,
    ...summary,
    cashInDrawer,
  };
}

export async function closeCashRegister(
  branchId: number,
  id: number,
  closedBy: string,
  closeInput?: {
    closingCashCount?: unknown;
    closingTransferCount?: unknown;
    closingNotes?: unknown;
  }
) {
  validatePositiveInteger(branchId, 'La sucursal');
  const closedByTrimmed = validateNonEmptyString(closedBy, 'El usuario que cierra la caja');
  const { closingCashCount, closingTransferCount, closingNotes } =
    closeInput ?? {};

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

    const closeData: Record<string, unknown> = {
      status: 'closed',
      closedAt: nowUTC(),
      closedBy: closedByTrimmed,
      ...summary,
    };

    const rawNotes = typeof closingNotes === 'string' ? closingNotes.trim() : '';
    if (rawNotes) {
      closeData.closingNotes = rawNotes;
    }

    const countValue = validateNonNegativeMoney(closingCashCount, 'El monto contado al cerrar');
    if (closingCashCount !== undefined && closingCashCount !== null && closingCashCount !== '') {
      closeData.closingCashCount = countValue;
      const expected = addMoney(parseMoney(cashRegister.initialAmount ?? 0), parseMoney(summary.cashTotal));
      const counted = parseMoney(countValue);
      const difference = moneyToNumber(subtractMoney(counted, expected));
      closeData.closingDifference = difference;
    }

    const transferCountValue = validateNonNegativeMoney(
      closingTransferCount,
      'La transferencia contada al cerrar'
    );
    if (closingTransferCount !== undefined && closingTransferCount !== null && closingTransferCount !== '') {
      closeData.closingTransferCount = transferCountValue;
      const expectedTransfer = parseMoney(summary.transferTotal);
      const countedTransfer = parseMoney(transferCountValue);
      const transferDifference = moneyToNumber(
        subtractMoney(countedTransfer, expectedTransfer)
      );
      closeData.closingTransferDifference = transferDifference;
    }

    const updated = await cashRegisterRepository.update(
      branchId,
      id,
      closeData as Partial<cashRegisterRepository.CashRegisterRow>,
      tx
    );

    if (!updated) {
      throw new NotFoundError('Caja', id);
    }

    return updated;
  });
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

/**
 * Reintegra el stock descontado por las ventas activas de las cajas dadas.
 * Solo se consideran ventas activas: las anuladas ya devolvieron su stock
 * al momento de anularse. Las ventas se borran después, dentro de la misma
 * transacción, por lo que el movimiento queda con sale_id en NULL y la
 * razón conserva la referencia para auditoría.
 */
async function restoreStockForDeletedCashRegisters(
  tx: typeof db,
  branchId: number,
  cashRegisterIds: number[]
) {
  for (const cashRegisterId of cashRegisterIds) {
    const activeSales = await saleRepository.findActiveWithDetailsByCashRegister(
      tx,
      branchId,
      cashRegisterId
    );

    for (const sale of activeSales) {
      const items = sale.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        recipeSnapshot: item.recipeSnapshots.map(
          (snapshot): RecipeItemConfig => ({
            supplyId: snapshot.supplyId,
            supplyName: snapshot.supplyName,
            supplyType: snapshot.supplyType,
            quantity: snapshot.quantity,
            autoDiscount: snapshot.autoDiscount,
            isOptional: snapshot.isOptional,
            selected: snapshot.selected,
            selectedByDefault: snapshot.selectedByDefault,
          })
        ),
      }));

      const { productById, recipesByProduct } = await buildProductContext(
        branchId,
        items.map((item) => item.productId),
        { dbOrTx: tx, includeDeleted: true }
      );

      await reintegrateStockForItems(
        tx,
        branchId,
        items,
        productById,
        recipesByProduct,
        { saleId: sale.id },
        'cancellation',
        `Eliminación de caja #${cashRegisterId} (venta #${sale.id})`
      );
    }
  }
}

export async function permanentlyDeleteCashRegister(branchId: number, id: number) {
  const cashRegister = await cashRegisterRepository.findById(branchId, id, true);

  if (!cashRegister || cashRegister.deletedAt === null) {
    throw new ValidationError('La caja no está en la papelera.');
  }

  return executeInTransaction(async (tx) => {
    await restoreStockForDeletedCashRegisters(tx, branchId, [id]);
    return cashRegisterRepository.hardDelete(branchId, id, tx);
  });
}

export async function listDeletedCashRegisterHistory(
  branchId: number,
  start: Date,
  end: Date,
  pagination?: PaginationParams
) {
  return cashRegisterRepository.findDeletedInRange(branchId, start, end, pagination);
}

export async function deleteAllClosedCashRegisters(branchId: number) {
  return cashRegisterRepository.softDeleteAllClosed(branchId);
}

export async function emptyTrash(branchId: number) {
  return executeInTransaction(async (tx) => {
    const deletedIds = await cashRegisterRepository.findDeletedIds(branchId, tx);

    if (deletedIds.length === 0) {
      return { deleted: 0 };
    }

    await restoreStockForDeletedCashRegisters(tx, branchId, deletedIds);
    return cashRegisterRepository.hardDeleteAllDeleted(branchId, tx);
  });
}

export async function autoCloseIfNeeded(branchId: number) {
  return getOpenCashRegister(branchId);
}
