import * as catalogRepository from '@/repositories/catalogRepository';
import * as branchService from '@/application/services/branchService';
import * as saleService from '@/application/services/saleService';
import { NotFoundError } from '@/domain/errors';
import { resolveProductImage } from '@/lib/product-image-storage';
import type { Branch, ProductRow, SaleItemInput, RecipeItemConfig } from '@/domain/types';
import type { RecipeBreakdownItem } from '@/application/services/saleService';

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
  breakdown: RecipeBreakdownItem[];
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

function toPublicCatalogProduct(
  product: ProductRow,
  availability: number,
  breakdown: RecipeBreakdownItem[],
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
    breakdown,
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
    products: products.map((product) => toPublicCatalogProduct(product, 0, [], undefined)),
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
        breakdown: [],
      };
      return toPublicCatalogProduct(
        product,
        entry.availability,
        entry.breakdown,
        entry.recipe
      );
    }),
    total,
  };
}

export async function validatePublicCart(
  branchId: number,
  items: SaleItemInput[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  >;
  breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
}> {
  await getBranch(branchId);
  const result = await saleService.validateCartAvailability(branchId, items);
  return {
    availabilityByProduct: result.availabilityByProduct,
    shortageByProduct: result.shortageByProduct,
    breakdownByProduct: result.breakdownByProduct,
  };
}
