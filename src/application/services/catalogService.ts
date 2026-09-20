import * as branchService from '@/application/services/branchService';
import * as saleService from '@/application/services/saleService';
import { NotFoundError } from '@/domain/errors';
import { resolveProductImage } from '@/lib/product-image-storage';
import { getCachedPublicCatalogBase } from '@/lib/server-cache';
import type { Branch, ProductRow, SaleItemInput, RecipeItemConfig } from '@/domain/types';

export type PublicCatalogProduct = Pick<
  ProductRow,
  | 'id'
  | 'name'
  | 'description'
  | 'type'
  | 'criticalSupplyType'
  | 'price'
  | 'unit'
  | 'imageUrl'
> & {
  availability: number;
  recipe?: RecipeItemConfig[];
};

export type PublicCatalogResponse = {
  branch: Branch;
  products: PublicCatalogProduct[];
  total: number;
};

export interface CatalogPagination {
  limit?: number;
  offset?: number;
}

/**
 * Construye el producto del catálogo público. No se incluye el `breakdown`
 * de insumos: la UI pública no lo muestra y transportarlo expondría datos
 * internos de stock en la respuesta HTTP.
 */
function toPublicCatalogProduct(
  product: ProductRow,
  availability: number,
  recipe?: RecipeItemConfig[]
): PublicCatalogProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    type: product.type,
    criticalSupplyType: product.criticalSupplyType,
    price: product.price,
    unit: product.unit,
    imageUrl: resolveProductImage(product),
    availability,
    recipe,
  };
}

async function getBranch(branchId: number): Promise<Branch> {
  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    throw new NotFoundError('Sucursal', branchId);
  }
  return branch;
}

export async function listPublicCatalog(
  branchId: number,
  pagination?: CatalogPagination
): Promise<PublicCatalogResponse> {
  const branch = await getBranch(branchId);
  const { products, total } = await getCachedPublicCatalogBase(
    branchId,
    pagination
  );
  return {
    branch,
    products: products.map((product) => toPublicCatalogProduct(product, 0)),
    total,
  };
}

export async function listPublicCatalogWithAvailability(
  branchId: number,
  pagination?: CatalogPagination
): Promise<PublicCatalogResponse> {
  const branch = await getBranch(branchId);
  // La base (productos + total) viene de la caché de servidor por tag
  // `public-catalog`; la disponibilidad se calcula en vivo porque cambia
  // con cada venta o reserva de pedido.
  const { products, total } = await getCachedPublicCatalogBase(
    branchId,
    pagination
  );
  const productIds = products.map((product) => product.id);

  const availabilityById: Record<number, saleService.ProductAvailability> =
    productIds.length > 0
      ? await saleService.calculateAvailabilityForProductIds(branchId, productIds)
      : {};

  return {
    branch,
    products: products.map((product) => {
      const entry = availabilityById[product.id] ?? {
        availability: 0,
      };
      return toPublicCatalogProduct(
        product,
        entry.availability,
        entry.recipe
      );
    }),
    total,
  };
}

/**
 * Valida la disponibilidad del carrito del flujo público. A diferencia de
 * `validateCartAvailability` (usado por el panel), la respuesta pública no
 * expone nombres de insumos ni cantidades internas: `shortageByProduct` solo
 * indica qué productos no alcanzan la disponibilidad, y el desglose por
 * insumo (`breakdownByProduct`) no se transporta.
 */
export async function validatePublicCart(
  branchId: number,
  items: SaleItemInput[],
  productIds?: number[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  shortageByProduct: Record<number, boolean>;
}> {
  await getBranch(branchId);

  // Consulta pura de disponibilidad (sin ítems de carrito): usa el mismo
  // cálculo que el catálogo público, con las reservas activas descontadas.
  // La usa el refresco incremental del catálogo para actualizar los
  // productos ya cargados sin re-descargar todas las páginas.
  if (items.length === 0 && productIds && productIds.length > 0) {
    const availabilityById =
      await saleService.calculateAvailabilityForProductIds(branchId, productIds);
    return {
      availabilityByProduct: Object.fromEntries(
        productIds.map((id) => [id, availabilityById[id]?.availability ?? 0])
      ),
      shortageByProduct: {},
    };
  }

  const result = await saleService.validateCartAvailability(
    branchId,
    items,
    productIds
  );
  return {
    availabilityByProduct: result.availabilityByProduct,
    shortageByProduct: Object.fromEntries(
      Object.keys(result.shortageByProduct).map((productId) => [
        productId,
        true,
      ])
    ),
  };
}
