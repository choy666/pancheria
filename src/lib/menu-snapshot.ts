import * as catalogService from '@/application/services/catalogService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as menuService from '@/application/services/menuService';
import { computeKioskBranchStatus } from '@/lib/kiosk-status';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { MenuSettings } from '@/lib/menu-pages';

/**
 * Snapshot que consume el menú digital `/menu`: lo entrega el SSR inicial de
 * la página y lo refresca `GET /api/public/menu` en cada poll. A diferencia
 * del de `/pantalla` no incluye videos ni playlist: el menú muestra el
 * catálogo completo siempre, paginado por categorías. `settings` trae la
 * personalización por sucursal (duración de página, filas, QR, ocultos).
 */
export type MenuSnapshot = {
  branch: Branch;
  isOpen: boolean;
  currentOpening: string;
  nextOpening: string;
  message: string;
  products: PublicCatalogProduct[];
  settings: MenuSettings;
};

/**
 * Snapshot único del menú digital `/menu`: sucursal con su estado operativo,
 * catálogo con disponibilidad y configuración propia de la sucursal.
 *
 * Lanza `NotFoundError` cuando la sucursal no existe o está inactiva
 * (heredado de `listPublicCatalogWithAvailability`).
 */
export async function buildMenuSnapshot(
  branchId: number
): Promise<MenuSnapshot> {
  const [catalog, cashRegister, settings] = await Promise.all([
    catalogService.listPublicCatalogWithAvailability(branchId),
    cashRegisterService.getOpenCashRegister(branchId),
    menuService.getSettings(branchId),
  ]);

  const { branch } = catalog;
  const status = computeKioskBranchStatus(branch, cashRegister !== null);

  return {
    branch,
    ...status,
    products: catalog.products,
    settings,
  };
}
