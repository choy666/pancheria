import { ZodError } from 'zod';
import * as menuRepository from '@/repositories/menuRepository';
import * as productRepository from '@/repositories/productRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import { isPublicSellableProduct } from '@/lib/catalog';
import { getMenuFilasPagina, getMenuPaginaMs } from '@/config/menu';
import { ValidationError } from '@/domain/errors';
import { menuSettingsSchema } from '@/lib/zod-schemas';
import type { MenuSettings } from '@/lib/menu-pages';
import type { ProductRow, ProductType } from '@/domain/types';

/**
 * Sin fila en `menu_settings` la sucursal conserva el comportamiento de las
 * variables `NEXT_PUBLIC_MENU_*` para duración y filas; el resto de las
 * opciones arranca con los mismos defaults que las columnas de la tabla:
 * grilla de 4 columnas, textos en escala normal, tarjetas con imagen,
 * orden de catálogo, descripciones visibles, franja QR con su CTA default
 * y todo el catálogo vendible en el tablero (sin ocultos ni destacados).
 */
function defaultSettings(): MenuSettings {
  return {
    paginaMs: getMenuPaginaMs(),
    filasPagina: getMenuFilasPagina(),
    gridColumns: 4,
    fontScale: 'normal',
    showDescriptions: true,
    cardStyle: 'image',
    sortOrder: 'catalog',
    showQrStrip: true,
    hiddenProductIds: [],
    featuredProductIds: [],
    qrStripText: 'Pedí desde tu celu',
  };
}

export async function getSettings(branchId: number): Promise<MenuSettings> {
  const row = await menuRepository.findSettings(branchId);
  if (!row) return defaultSettings();

  return {
    paginaMs: row.paginaMs,
    filasPagina: row.filasPagina,
    gridColumns: row.gridColumns,
    fontScale: row.fontScale,
    showDescriptions: row.showDescriptions,
    cardStyle: row.cardStyle,
    sortOrder: row.sortOrder,
    showQrStrip: row.showQrStrip,
    hiddenProductIds: row.hiddenProductIds,
    featuredProductIds: row.featuredProductIds,
    qrStripText: row.qrStripText,
  };
}

/**
 * Verifica que cada ID sea un producto vendible al público de la sucursal.
 * Es la validación compartida de las listas de curaduría del menú (ocultos
 * y destacados): referenciar un insumo o un producto que nunca podría
 * aparecer en el tablero sería un efecto nulo que confundiría al operador.
 * `accion` completa el mensaje de producto eliminado ('ocultarse del menú' |
 * 'destacarse en el menú').
 */
function assertSellableMenuProducts(
  ids: number[],
  productById: Map<number, ProductRow>,
  accion: string
): void {
  for (const id of ids) {
    const product = productById.get(id);
    if (!product) {
      throw new ValidationError(
        `El producto con ID ${id} no existe en esta sucursal.`
      );
    }
    if (product.deletedAt) {
      throw new ValidationError(
        `El producto "${product.name}" está eliminado y no puede ${accion}.`
      );
    }
    if (!isPublicSellableProduct(product)) {
      throw new ValidationError(
        `El producto "${product.name}" no es vendible al público y nunca aparecería en el menú.`
      );
    }
  }
}

/**
 * Persiste la configuración del menú de una sucursal. Las listas de ocultos
 * y destacados se validan contra los productos vendibles al público de esa
 * sucursal en una sola consulta; los duplicados se consolidan antes de
 * guardar.
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
  const featuredProductIds = [...new Set(data.featuredProductIds)];

  const idsAValidar = [...new Set([...hiddenProductIds, ...featuredProductIds])];
  if (idsAValidar.length > 0) {
    const found = await productRepository.findByIds(
      branchId,
      idsAValidar,
      true
    );
    const productById = new Map(found.map((product) => [product.id, product]));

    assertSellableMenuProducts(
      hiddenProductIds,
      productById,
      'ocultarse del menú'
    );
    assertSellableMenuProducts(
      featuredProductIds,
      productById,
      'destacarse en el menú'
    );
  }

  return menuRepository.upsertSettings(branchId, {
    ...data,
    hiddenProductIds,
    featuredProductIds,
  });
}

/**
 * Productos vendibles al público de la sucursal para los selectores de
 * curaduría del configurador (ocultos y destacados): la lista que el menú
 * podría mostrar, sin importar el stock del momento (la curaduría no
 * depende de la disponibilidad).
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
