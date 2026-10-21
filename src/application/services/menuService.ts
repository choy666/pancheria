import { ZodError } from 'zod';
import * as menuRepository from '@/repositories/menuRepository';
import * as productRepository from '@/repositories/productRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import { isPublicSellableProduct } from '@/lib/catalog';
import { getMenuFilasPagina, getMenuPaginaMs } from '@/config/menu';
import { ValidationError } from '@/domain/errors';
import { menuSettingsSchema } from '@/lib/zod-schemas';
import type { MenuSettings } from '@/lib/menu-pages';
import type { ProductType } from '@/domain/types';

/**
 * Sin fila en `menu_settings` la sucursal conserva el comportamiento de las
 * variables `NEXT_PUBLIC_MENU_*`: rotación de 12s, 4 filas por página, la
 * franja QR visible y todo el catálogo vendible en el tablero.
 */
function defaultSettings(): MenuSettings {
  return {
    paginaMs: getMenuPaginaMs(),
    filasPagina: getMenuFilasPagina(),
    showQrStrip: true,
    hiddenProductIds: [],
  };
}

export async function getSettings(branchId: number): Promise<MenuSettings> {
  const row = await menuRepository.findSettings(branchId);
  if (!row) return defaultSettings();

  return {
    paginaMs: row.paginaMs,
    filasPagina: row.filasPagina,
    showQrStrip: row.showQrStrip,
    hiddenProductIds: row.hiddenProductIds,
  };
}

/**
 * Persiste la configuración del menú de una sucursal. Los IDs ocultos deben
 * ser productos vendibles al público de esa sucursal: ocultar un insumo o un
 * producto que nunca podría aparecer en el tablero sería un efecto nulo que
 * confundiría al operador. Duplicados se consolidan antes de guardar.
 */
export async function updateSettings(branchId: number, input: unknown) {
  let data;
  try {
    data = menuSettingsSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('. ')
      );
    }
    throw error;
  }

  const hiddenProductIds = [...new Set(data.hiddenProductIds)];

  if (hiddenProductIds.length > 0) {
    const found = await productRepository.findByIds(
      branchId,
      hiddenProductIds,
      true
    );
    const productById = new Map(found.map((product) => [product.id, product]));

    for (const id of hiddenProductIds) {
      const product = productById.get(id);
      if (!product) {
        throw new ValidationError(
          `El producto con ID ${id} no existe en esta sucursal.`
        );
      }
      if (product.deletedAt) {
        throw new ValidationError(
          `El producto "${product.name}" está eliminado y no puede ocultarse del menú.`
        );
      }
      if (!isPublicSellableProduct(product)) {
        throw new ValidationError(
          `El producto "${product.name}" no es vendible al público y nunca aparecería en el menú.`
        );
      }
    }
  }

  return menuRepository.upsertSettings(branchId, {
    ...data,
    hiddenProductIds,
  });
}

/**
 * Productos vendibles al público de la sucursal para el selector de ocultos
 * del configurador: la lista que el menú podría mostrar, sin importar el
 * stock del momento (ocultar no depende de la disponibilidad).
 */
export type MenuProductItem = {
  id: number;
  name: string;
  type: ProductType;
};

export async function listMenuProducts(
  branchId: number
): Promise<MenuProductItem[]> {
  const products = await catalogRepository.findPublicProducts(branchId);
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    type: product.type,
  }));
}
