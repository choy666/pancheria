import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products, recipes } from '@/db/schema';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import {
  addItemToSummary,
  fillMissingCriticalSupplies,
} from '@/lib/summary-helpers';
export { calculateCompoundAvailability } from '@/lib/availability-helpers';
import type { CompoundAvailabilityRecipe } from '@/lib/availability-helpers';
import type {
  CriticalSupplyType,
  PaymentPart,
  ProductRow,
  RecipeItemConfig,
} from '@/domain/types';

export async function findRecipesForProducts(
  branchId: number,
  compoundProductIds: number[],
  dbOrTx: typeof db = db
): Promise<RecipeWithSupply[]> {
  if (compoundProductIds.length === 0) return [];

  const allRecipes = (await dbOrTx.query.recipes.findMany({
    where: inArray(recipes.compoundProductId, compoundProductIds),
    with: { supply: true },
  })) as RecipeWithSupply[];

  return allRecipes.filter((recipe) => recipe.supply?.branchId === branchId);
}

export type RecipeWithSupply = typeof recipes.$inferSelect & {
  supply: ProductRow | null;
} & CompoundAvailabilityRecipe;

type SaleItemWithProduct = {
  quantity: number;
  product: {
    id: number;
    name: string;
    type: string;
    criticalSupplyType: CriticalSupplyType | null;
  } | null;
  recipeSnapshot?: RecipeItemConfig[];
};

export type SaleWithItems = {
  total: number;
  paymentMethod?: 'cash' | 'transfer';
  payments?: PaymentPart[];
  items: SaleItemWithProduct[];
};

export function groupRecipesByProduct(allRecipes: RecipeWithSupply[]) {
  const recipesByProduct = new Map<number, RecipeWithSupply[]>();

  for (const recipeItem of allRecipes) {
    if (!recipesByProduct.has(recipeItem.compoundProductId)) {
      recipesByProduct.set(recipeItem.compoundProductId, []);
    }
    recipesByProduct.get(recipeItem.compoundProductId)?.push(recipeItem);
  }

  return recipesByProduct;
}

export async function calculateSummaryFromSales(
  branchId: number,
  activeSales: SaleWithItems[],
  dbOrTx: typeof db = db
) {
  let cashTotal = parseMoney(0);
  let transferTotal = parseMoney(0);
  const productsSummary: Record<string, number> = {};
  const criticalSuppliesSummary: Record<string, number> = {};
  const recipeSuppliesSummary: Record<string, number> = {};

  const compoundProductIds = new Set<number>();
  for (const sale of activeSales) {
    for (const item of sale.items ?? []) {
      if (item.product?.type === 'compound') {
        compoundProductIds.add(item.product.id);
      }
    }
  }

  const recipesByProduct = new Map<number, RecipeWithSupply[]>();
  if (compoundProductIds.size > 0) {
    const filteredRecipes = await findRecipesForProducts(
      branchId,
      Array.from(compoundProductIds),
      dbOrTx
    );

    groupRecipesByProduct(filteredRecipes).forEach((value, key) => {
      recipesByProduct.set(key, value);
    });
  }

  for (const sale of activeSales) {
    const payments = sale.payments;
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        const amount = parseMoney(payment.amount);
        if (payment.method === 'cash') {
          cashTotal = addMoney(cashTotal, amount);
        } else {
          transferTotal = addMoney(transferTotal, amount);
        }
      }
    } else if (sale.paymentMethod) {
      const saleTotal = parseMoney(sale.total);
      if (sale.paymentMethod === 'cash') {
        cashTotal = addMoney(cashTotal, saleTotal);
      } else {
        transferTotal = addMoney(transferTotal, saleTotal);
      }
    }

    for (const item of sale.items ?? []) {
      const product = item.product;
      if (!product) continue;

      addItemToSummary(
        productsSummary,
        criticalSuppliesSummary,
        recipeSuppliesSummary,
        product,
        item.quantity,
        recipesByProduct,
        item.recipeSnapshot
      );
    }
  }

  const total = addMoney(cashTotal, transferTotal);

  const criticalSupplies = await dbOrTx.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      eq(products.type, 'critical_supply'),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ),
  });

  fillMissingCriticalSupplies(criticalSuppliesSummary, criticalSupplies);

  return {
    total: moneyToNumber(total),
    cashTotal: moneyToNumber(cashTotal),
    transferTotal: moneyToNumber(transferTotal),
    totalSales: activeSales.length,
    productsSummary,
    criticalSuppliesSummary,
    recipeSuppliesSummary,
  };
}
