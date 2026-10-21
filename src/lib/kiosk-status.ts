import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';
import type { Branch } from '@/domain/types';

export type KioskBranchStatus = {
  isOpen: boolean;
  currentOpening: string;
  nextOpening: string;
  message: string;
};

/**
 * Estado operativo común de las pantallas kiosk (`/pantalla`, `/menu`).
 * Misma semántica que `GET /api/public/sucursal/estado`: sin horarios
 * configurados basta una caja abierta para considerar la sucursal abierta.
 */
export function computeKioskBranchStatus(
  branch: Branch,
  hasOpenCashRegister: boolean
): KioskBranchStatus {
  const hasOpeningHours = (branch.openingHours ?? []).length > 0;
  const isOpen =
    hasOpenCashRegister && (!hasOpeningHours || isBranchOpen(branch));

  const currentOpening = getTodayOpening(branch);
  const nextOpening = getNextOpening(branch);
  const message = isOpen
    ? `Sucursal abierta: ${currentOpening}.`
    : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;

  return { isOpen, currentOpening, nextOpening, message };
}
