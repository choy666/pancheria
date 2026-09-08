import * as catalogRepository from '@/repositories/catalogRepository';
import * as branchService from '@/application/services/branchService';
import * as saleService from '@/application/services/saleService';
import { NotFoundError } from '@/domain/errors';
import { resolveProductImage } from '@/lib/product-image-storage';
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

/**
 * Devuelve el total de productos públicos de la sucursal. Solo consulta la
 * base cuando hay paginación; sin paginación el listado ya es el total.
 */
async function getPublicProductsTotal(
  branchId: number,
  loadedCount: number,
  pagination?: CatalogPagination
): Promise<number> {
  const isPaginated =
    pagination?.limit !== undefined || pagination?.offset !== undefined;
  if (!isPaginated) return loadedCount;
  return catalogRepository.countPublicProducts(branchId);
}

export async function listPublicCatalog(
  branchId: number,
  pagination?: CatalogPagination
): Promise<PublicCatalogResponse> {
  const branch = await getBranch(branchId);
  const products = await catalogRepository.findPublicProducts(branchId, pagination);
  const total = await getPublicProductsTotal(branchId, products.length, pagination);
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
  const products = await catalogRepository.findPublicProducts(branchId, pagination);
  const total = await getPublicProductsTotal(branchId, products.length, pagination);
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
  items: SaleItemInput[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  shortageByProduct: Record<number, boolean>;
}> {
  await getBranch(branchId);
  const result = await saleService.validateCartAvailability(branchId, items);
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
