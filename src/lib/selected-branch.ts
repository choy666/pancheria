const STORAGE_KEY = 'pancheria-branch-id';

export const BRANCH_STORAGE_KEY = STORAGE_KEY;

/**
 * Devuelve la sucursal que el cliente seleccionó en el catálogo público
 * (`/pedido` la persiste en localStorage). `null` si no hay valor válido.
 */
export function getStoredBranchId(): number | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
