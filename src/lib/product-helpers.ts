import { InsufficientStockError, NotFoundError, ValidationError } from '@/domain/errors';
import { validateBranchOwnership } from '@/lib/validation-helpers';
import { isPublicSellableProduct } from '@/lib/catalog';
import type { ProductRow, SaleItemInput, RecipeItemConfig } from '@/domain/types';
import { db } from '@/db';
import * as productRepository from '@/repositories/productRepository';
import * as orderStockReservationRepository from '@/repositories/orderStockReservationRepository';
import { collectStockProductIdsToLock } from '@/lib/stock-helpers';
import { calculateCompoundAvailability } from '@/lib/availability-helpers';
import {
  findRecipesForProducts,
  groupRecipesByProduct,
  type RecipeWithSupply,
} from '@/lib/recipe-helpers';

function recipeItemToConfig(
  recipe: RecipeWithSupply,
  selected: boolean
): RecipeItemConfig {
  return {
    supplyId: recipe.supplyId,
    supplyName: recipe.supply?.name ?? `Insumo ${recipe.supplyId}`,
    supplyType: recipe.supply?.type ?? 'critical_supply',
    quantity: recipe.quantity,
    autoDiscount: recipe.autoDiscount,
    isOptional: recipe.isOptional,
    selected,
    selectedByDefault: recipe.selectedByDefault,
  };
}

function isRecipeItemSelected(
  recipe: RecipeWithSupply,
  selectedRecipeItemIds: number[]
): boolean {
  if (!recipe.isOptional) return true;
  return selectedRecipeItemIds.includes(recipe.supplyId);
}

export function buildRecipeSnapshot(
  recipeItems: RecipeWithSupply[],
  selectedRecipeItemIds: number[]
): RecipeItemConfig[] {
  return recipeItems.map((recipe) =>
    recipeItemToConfig(
      recipe,
      isRecipeItemSelected(recipe, selectedRecipeItemIds)
    )
  );
}

export interface RecipeBreakdownItem {
  supplyName: string;
  available: number;
  required: number;
  isLimiting: boolean;
}

export interface ProductAvailability {
  availability: number;
  breakdown: RecipeBreakdownItem[];
  recipe?: RecipeItemConfig[];
}

export async function buildProductContext(
  branchId: number,
  productIds: number[],
  options?: { includeDeleted?: boolean; dbOrTx?: typeof import('@/db').db }
): Promise<{
  productsList: ProductRow[];
  productById: Map<number, ProductRow>;
  recipesByProduct: Map<number, RecipeWithSupply[]>;
}> {
  const client = options?.dbOrTx;
  const productsList = client
    ? await productRepository.findByIdsForUpdate(
        branchId,
        productIds,
        options?.includeDeleted,
        client
      )
    : await productRepository.findByIds(
        branchId,
        productIds,
        options?.includeDeleted
      );

  const uniqueProductIds = Array.from(new Set(productIds));
  if (productsList.length !== uniqueProductIds.length) {
    throw new NotFoundError('Producto');
  }

  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  let recipesByProduct = new Map<number, RecipeWithSupply[]>();
  if (compoundProductIds.length > 0) {
    const allRecipes = await findRecipesForProducts(
      branchId,
      compoundProductIds,
      client ?? db
    );
    recipesByProduct = groupRecipesByProduct(allRecipes);
  }

  return { productsList, productById, recipesByProduct };
}

interface AvailabilityContext {
  productsList: ProductRow[];
  productById: Map<number, ProductRow>;
  recipesByProduct: Map<number, RecipeWithSupply[]>;
  supplyStockById: Record<number, number>;
  supplyNameById: Record<number, string>;
}

async function buildAvailabilityContext(
  branchId: number,
  productIds: number[],
  dbOrTx?: typeof import('@/db').db,
  recipeSnapshotsByProductId?: Map<number, RecipeItemConfig[]>
): Promise<AvailabilityContext> {
  const client = dbOrTx;
  const productsList = client
    ? await productRepository.findByIdsForUpdate(
        branchId,
        productIds,
        false,
        client
      )
    : await productRepository.findByIds(branchId, productIds);

  const productById = new Map(productsList.map((p) => [p.id, p]));

  const compoundProductIds = productsList
    .filter((p) => p.type === 'compound')
    .map((p) => p.id);

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();
  const supplyStockById: Record<number, number> = {};
  const supplyNameById: Record<number, string> = {};

  for (const product of productsList) {
    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      supplyStockById[product.id] = product.stock;
      supplyNameById[product.id] = product.name;
    }
  }

  if (recipeSnapshotsByProductId) {
    for (const [productId, snapshot] of recipeSnapshotsByProductId.entries()) {
      const product = productById.get(productId);
      if (!product || product.type !== 'compound') continue;

      for (const config of snapshot) {
        if (!config.autoDiscount) continue;
        const supply = productById.get(config.supplyId);
        if (supply) {
          supplyStockById[config.supplyId] = supply.stock;
          supplyNameById[config.supplyId] = supply.name;
        }
      }
    }
  }

  if (compoundProductIds.length > 0) {
    const allRecipes = await findRecipesForProducts(
      branchId,
      compoundProductIds,
      client ?? db
    );

    for (const recipeItem of allRecipes) {
      if (recipeItem.autoDiscount) {
        supplyStockById[recipeItem.supplyId] = recipeItem.supply?.stock ?? 0;
        supplyNameById[recipeItem.supplyId] =
          recipeItem.supply?.name ?? `Insumo ${recipeItem.supplyId}`;
      }
    }

    groupRecipesByProduct(allRecipes).forEach((value, key) => {
      recipesByProduct.set(key, value);
    });
  }

  return {
    productsList,
    productById,
    recipesByProduct,
    supplyStockById,
    supplyNameById,
  };
}

function buildBreakdown(
  criticalItems: { supplyId: number; quantity: number }[],
  supplyStockById: Record<number, number>,
  supplyNameById: Record<number, string>,
  consumedBySupply: Record<number, number> = {}
): RecipeBreakdownItem[] {
  let bottleneck: { supplyId: number; capacity: number } | null = null;
  let minCapacity = Infinity;

  for (const recipeItem of criticalItems) {
    const stock = supplyStockById[recipeItem.supplyId] ?? 0;
    const consumed = consumedBySupply[recipeItem.supplyId] ?? 0;
    const capacity = Math.floor(
      Math.max(0, stock - consumed) / recipeItem.quantity
    );
    if (capacity < minCapacity) {
      minCapacity = capacity;
      bottleneck = { supplyId: recipeItem.supplyId, capacity };
    }
  }

  return criticalItems.map((recipeItem) => {
    const stock = supplyStockById[recipeItem.supplyId] ?? 0;
    const consumed = consumedBySupply[recipeItem.supplyId] ?? 0;
    return {
      supplyName:
        supplyNameById[recipeItem.supplyId] ??
        `Insumo ${recipeItem.supplyId}`,
      available: Math.max(0, stock - consumed),
      required: recipeItem.quantity,
      isLimiting: bottleneck?.supplyId === recipeItem.supplyId,
    };
  });
}

export async function calculateAvailability(
  branchId: number,
  productId: number
): Promise<number> {
  const result = await calculateAvailabilityForProductIds(branchId, [productId]);
  return result[productId]?.availability ?? 0;
}

export async function calculateAvailabilityForProductIds(
  branchId: number,
  productIds: number[]
): Promise<Record<number, ProductAvailability>> {
  if (productIds.length === 0) return {};

  const { productById, recipesByProduct, supplyStockById, supplyNameById } =
    await buildAvailabilityContext(branchId, productIds);

  const idsToLockSet = new Set<number>();
  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product || product.type === 'service') continue;

    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        if (recipeItem.autoDiscount) idsToLockSet.add(recipeItem.supplyId);
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      idsToLockSet.add(product.id);
    }
  }

  const idsToLock = Array.from(idsToLockSet);
  if (idsToLock.length > 0) {
    const reservations =
      await orderStockReservationRepository.findActiveReservationsByProductIds(
        db,
        branchId,
        idsToLock
      );
    for (const reservation of reservations) {
      if (supplyStockById[reservation.productId] !== undefined) {
        supplyStockById[reservation.productId] -= reservation.quantity;
      }
    }
  }

  const resultById: Record<number, ProductAvailability> = {};

  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) {
      resultById[productId] = { availability: 0, breakdown: [] };
      continue;
    }

    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      const criticalItems = recipeList.filter((r) => r.autoDiscount);
      const breakdown = buildBreakdown(
        criticalItems,
        supplyStockById,
        supplyNameById
      );

      const defaultSelectedIds = recipeList
        .filter((r) => r.isOptional && r.selectedByDefault)
        .map((r) => r.supplyId);

      resultById[product.id] = {
        availability: calculateCompoundAvailability(
          recipeList,
          supplyStockById
        ),
        breakdown,
        recipe: buildRecipeSnapshot(recipeList, defaultSelectedIds),
      };
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      resultById[product.id] = {
        availability: supplyStockById[product.id] ?? 0,
        breakdown: [],
      };
    } else if (product.type === 'service') {
      resultById[product.id] = {
        availability: Number.MAX_SAFE_INTEGER,
        breakdown: [],
      };
    } else {
      resultById[product.id] = { availability: 0, breakdown: [] };
    }
  }

  return resultById;
}

export function validateProductsForOperation(
  items: { productId: number }[],
  productById: Map<number, ProductRow>,
  branchId: number,
  operation: 'pedido' | 'venta'
) {
  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      throw new NotFoundError('Producto', item.productId);
    }

    validateBranchOwnership(product, branchId, 'Producto');

    if (!product.isActive) {
      throw new ValidationError(`El producto ${product.name} no está activo.`);
    }

    if (!isPublicSellableProduct(product)) {
      const operationLabel = operation === 'pedido' ? 'el pedido' : 'la venta';
      throw new ValidationError(
        `El producto ${product.name} no está disponible para ${operationLabel}.`
      );
    }
  }
}

function getRecipeListForItem(
  item: SaleItemInput,
  product: ProductRow,
  recipesByProduct: Map<number, RecipeWithSupply[]>
): { supplyId: number; quantity: number; autoDiscount: boolean; selected: boolean }[] {
  if (product.type !== 'compound') return [];

  if (item.recipeSnapshot && item.recipeSnapshot.length > 0) {
    return item.recipeSnapshot;
  }

  const recipes = recipesByProduct.get(product.id) ?? [];
  const selectedIds = item.selectedRecipeItemIds ?? [];
  return recipes.map((recipe) => ({
    supplyId: recipe.supplyId,
    quantity: recipe.quantity,
    autoDiscount: recipe.autoDiscount,
    selected: isRecipeItemSelected(recipe, selectedIds),
  }));
}

export async function validateCartAvailability(
  branchId: number,
  items: SaleItemInput[],
  productIds?: number[],
  dbOrTx?: typeof import('@/db').db,
  excludeOrderId?: number
): Promise<{
  availabilityByProduct: Record<number, number>;
  consumedBySupply: Record<number, number>;
  shortageByProduct: Record<number, { available: number; required: number; supplyName: string }>;
  breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
}> {
  const itemProductIds = items.map((item) => item.productId);
  const snapshotSupplyIds = items.flatMap(
    (item) =>
      item.recipeSnapshot
        ?.filter((config) => config.autoDiscount)
        .map((config) => config.supplyId) ?? []
  );
  const allProductIds = Array.from(
    new Set([...itemProductIds, ...(productIds ?? []), ...snapshotSupplyIds])
  );

  const recipeSnapshotsByProductId = new Map<number, RecipeItemConfig[]>();
  for (const item of items) {
    if (!item.recipeSnapshot || item.recipeSnapshot.length === 0) continue;
    const existing = recipeSnapshotsByProductId.get(item.productId) ?? [];
    recipeSnapshotsByProductId.set(item.productId, [
      ...existing,
      ...item.recipeSnapshot,
    ]);
  }

  const {
    productsList,
    productById,
    recipesByProduct,
    supplyStockById,
    supplyNameById,
  } = await buildAvailabilityContext(
    branchId,
    allProductIds,
    dbOrTx,
    recipeSnapshotsByProductId
  );

  const idsToLock = collectStockProductIdsToLock(
    items,
    productById,
    recipesByProduct
  );
  const idsToLockSet = new Set(idsToLock);
  const productIdsToConsider = productIds ?? itemProductIds;

  for (const productId of productIdsToConsider) {
    const product = productById.get(productId);
    if (!product || product.type === 'service') continue;

    if (product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      for (const recipeItem of recipeList) {
        if (recipeItem.autoDiscount) idsToLockSet.add(recipeItem.supplyId);
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      idsToLockSet.add(product.id);
    }
  }

  const idsToLockArray = Array.from(idsToLockSet);

  if (idsToLockArray.length > 0 && dbOrTx) {
    const reservations =
      await orderStockReservationRepository.findActiveReservationsByProductIds(
        dbOrTx,
        branchId,
        idsToLockArray,
        excludeOrderId
      );
    for (const reservation of reservations) {
      if (supplyStockById[reservation.productId] !== undefined) {
        supplyStockById[reservation.productId] -= reservation.quantity;
      }
    }
  }

  for (const item of items) {
    if (!productById.has(item.productId)) {
      throw new NotFoundError('Producto', item.productId);
    }
  }

  const consumedBySupply: Record<number, number> = {};

  for (const item of items) {
    const product = productById.get(item.productId)!;
    if (product.type === 'compound') {
      const recipeList = getRecipeListForItem(item, product, recipesByProduct);
      for (const recipeItem of recipeList) {
        if (!recipeItem.autoDiscount || !recipeItem.selected) continue;
        consumedBySupply[recipeItem.supplyId] =
          (consumedBySupply[recipeItem.supplyId] ?? 0) +
          item.quantity * recipeItem.quantity;
      }
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      consumedBySupply[product.id] =
        (consumedBySupply[product.id] ?? 0) + item.quantity;
    }
  }

  const availabilityByProduct: Record<number, number> = {};
  const targetProductIds =
    allProductIds.length > 0 ? allProductIds : itemProductIds;

  for (const productId of targetProductIds) {
    const product = productById.get(productId);
    if (!product) {
      availabilityByProduct[productId] = 0;
      continue;
    }

    if (product.type === 'service') {
      availabilityByProduct[productId] = Number.MAX_SAFE_INTEGER;
    } else if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      availabilityByProduct[productId] =
        (supplyStockById[product.id] ?? 0) -
        (consumedBySupply[product.id] ?? 0);
    } else if (product.type === 'compound') {
      availabilityByProduct[productId] = calculateCompoundAvailability(
        recipesByProduct.get(product.id) ?? [],
        supplyStockById,
        consumedBySupply
      );
    } else {
      availabilityByProduct[productId] = 0;
    }
  }

  const shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  > = {};

  const breakdownByProduct: Record<number, RecipeBreakdownItem[]> = {};

  for (const product of productsList) {
    if (product.type !== 'compound') continue;

    const criticalItems = (recipesByProduct.get(product.id) ?? []).filter(
      (r) => r.autoDiscount
    );

    breakdownByProduct[product.id] = buildBreakdown(
      criticalItems,
      supplyStockById,
      supplyNameById,
      consumedBySupply
    );
  }

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || product.type === 'service') continue;

    if (
      product.type === 'critical_supply' &&
      product.criticalSupplyType === 'beverage'
    ) {
      const available = supplyStockById[product.id] ?? 0;
      const required = consumedBySupply[product.id] ?? 0;
      if (required > available) {
        shortageByProduct[product.id] = {
          available,
          required,
          supplyName: supplyNameById[product.id] ?? product.name,
        };
      }
    } else if (product.type === 'compound') {
      const criticalItems = getRecipeListForItem(item, product, recipesByProduct).filter(
        (recipeItem) => recipeItem.autoDiscount && recipeItem.selected
      );
      let bottleneck: { available: number; required: number; supplyName: string } | null = null;
      let minCapacity = Infinity;

      for (const recipeItem of criticalItems) {
        const available = supplyStockById[recipeItem.supplyId] ?? 0;
        const required = consumedBySupply[recipeItem.supplyId] ?? 0;
        const capacity = Math.floor(
          (available - required) / recipeItem.quantity
        );
        if (capacity < minCapacity) {
          minCapacity = capacity;
          bottleneck = {
            available,
            required,
            supplyName:
              supplyNameById[recipeItem.supplyId] ??
              `Insumo ${recipeItem.supplyId}`,
          };
        }
      }

      if (minCapacity < 0 && bottleneck) {
        shortageByProduct[product.id] = bottleneck;
      }
    }
  }

  return { availabilityByProduct, consumedBySupply, shortageByProduct, breakdownByProduct };
}

export function assertNoStockShortage(
  shortageByProduct: Record<
    number,
    { available: number; required: number; supplyName: string }
  >,
  productById: Map<number, ProductRow>
) {
  const productIds = Object.keys(shortageByProduct);
  if (productIds.length === 0) return;

  const productId = Number(productIds[0]);
  const product = productById.get(productId);
  const shortage = shortageByProduct[productId];
  if (!product || !shortage) return;

  throw new InsufficientStockError(
    product.name,
    shortage.available,
    shortage.required,
    shortage.supplyName !== product.name ? shortage.supplyName : undefined
  );
}
