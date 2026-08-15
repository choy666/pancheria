import * as catalogRepository from '@/repositories/catalogRepository';
import * as branchService from '@/application/services/branchService';
import * as saleService from '@/application/services/saleService';
import { NotFoundError } from '@/domain/errors';
import type { ProductRow, SaleItemInput } from '@/domain/types';

export type PublicCatalogProduct = Pick<
  ProductRow,
  | 'id'
  | 'name'
  | 'description'
  | 'type'
  | 'criticalSupplyType'
  | 'price'
  | 'unit'
> & {
  availability: number;
};

function toPublicCatalogProduct(
  product: ProductRow,
  availability: number
): PublicCatalogProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    type: product.type,
    criticalSupplyType: product.criticalSupplyType,
    price: product.price,
    unit: product.unit,
    availability,
  };
}

async function validateBranchExists(branchId: number) {
  const branch = await branchService.getBranchById(branchId);
  if (!branch) {
    throw new NotFoundError('Sucursal', branchId);
  }
}

export async function listPublicCatalog(branchId: number): Promise<PublicCatalogProduct[]> {
  await validateBranchExists(branchId);
  const products = await catalogRepository.findPublicProducts(branchId);
  return products.map((product) => toPublicCatalogProduct(product, 0));
}

export async function listPublicCatalogWithAvailability(
  branchId: number
): Promise<PublicCatalogProduct[]> {
  await validateBranchExists(branchId);
  const products = await catalogRepository.findPublicProducts(branchId);
  const productIds = products.map((product) => product.id);

  const availability = productIds.length > 0
    ? await saleService.calculateAvailabilityForProductIds(branchId, productIds)
    : {};

  return products.map((product) =>
    toPublicCatalogProduct(product, availability[product.id] ?? 0)
  );
}

export async function validatePublicCart(
  branchId: number,
  items: SaleItemInput[],
  productIds?: number[]
): Promise<{
  availabilityByProduct: Record<number, number>;
  shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  >;
}> {
  await validateBranchExists(branchId);
  const result = await saleService.validateCartAvailability(branchId, items, productIds);
  return {
    availabilityByProduct: result.availabilityByProduct,
    shortageByProduct: result.shortageByProduct,
  };
}
