import { db } from '@/db';
import * as productRepository from '@/repositories/productRepository';
import { addMoney, moneyToNumber, parseMoney } from '@/lib/money';
import {
  addItemToSummary,
  fillMissingCriticalSupplies,
} from '@/lib/summary-helpers';
export { calculateCompoundAvailability } from '@/lib/availability-helpers';
import {
  findRecipesForProducts,
  groupRecipesByProduct,
  type RecipeWithSupply,
} from '@/lib/recipe-helpers';
import { getCashRegisterSummaryPageSize } from '@/config/caja';
import type {
  CriticalSupplyType,
  PaymentPart,
  ProductType,
  RecipeItemConfig,
} from '@/domain/types';

type SaleItemWithProduct = {
  quantity: number;
  productId: number | null;
  productName: string;
  productType: ProductType | null;
  criticalSupplyType: CriticalSupplyType | null;
  // `product` queda solo como respaldo para filas viejas sin snapshot.
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

type SummaryState = {
  cashTotal: ReturnType<typeof parseMoney>;
  transferTotal: ReturnType<typeof parseMoney>;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
};

function createSummaryState(): SummaryState {
  return {
    cashTotal: parseMoney(0),
    transferTotal: parseMoney(0),
    totalSales: 0,
    productsSummary: {},
    criticalSuppliesSummary: {},
  };
}

/**
 * Carga las recetas de los productos compuestos que todavía no están en el
 * mapa. Se invoca por página para no depender de un repaso previo sobre todo
 * el set de ventas.
 */
async function collectMissingRecipes(
  branchId: number,
  sales: SaleWithItems[],
  recipesByProduct: Map<number, RecipeWithSupply[]>,
  dbOrTx: typeof db
) {
  const missingProductIds = new Set<number>();
  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      // Tipo del snapshot primero: un compuesto purgado igual tiene que
      // aportar su receta. Si el ítem ya tiene snapshot propio no hace
      // falta buscar la receta viva.
      const productType = item.productType ?? item.product?.type;
      if (
        productType === 'compound' &&
        item.productId != null &&
        !item.recipeSnapshot?.length &&
        !recipesByProduct.has(item.productId)
      ) {
        missingProductIds.add(item.productId);
      }
    }
  }

  if (missingProductIds.size === 0) return;

  const filteredRecipes = await findRecipesForProducts(
    branchId,
    Array.from(missingProductIds),
    dbOrTx
  );

  groupRecipesByProduct(filteredRecipes).forEach((value, key) => {
    recipesByProduct.set(key, value);
  });
}

function addSalesToSummaryState(
  state: SummaryState,
  sales: SaleWithItems[],
  recipesByProduct: Map<number, RecipeWithSupply[]>
) {
  for (const sale of sales) {
    state.totalSales += 1;

    const payments = sale.payments;
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        const amount = parseMoney(payment.amount);
        if (payment.method === 'cash') {
          state.cashTotal = addMoney(state.cashTotal, amount);
        } else {
          state.transferTotal = addMoney(state.transferTotal, amount);
        }
      }
    } else if (sale.paymentMethod) {
      const saleTotal = parseMoney(sale.total);
      if (sale.paymentMethod === 'cash') {
        state.cashTotal = addMoney(state.cashTotal, saleTotal);
      } else {
        state.transferTotal = addMoney(state.transferTotal, saleTotal);
      }
    }

    for (const item of sale.items ?? []) {
      // El snapshot del ítem preserva nombre/tipo aunque el producto haya
      // sido renombrado o purgado; la relación queda solo para filas
      // legacy sin backfill.
      const productName = item.productName ?? item.product?.name;
      const productType = item.productType ?? item.product?.type;
      const criticalSupplyType =
        item.criticalSupplyType ?? item.product?.criticalSupplyType ?? null;
      if (!productName || !productType) continue;

      addItemToSummary(
        state.productsSummary,
        state.criticalSuppliesSummary,
        {
          id: item.productId ?? item.product?.id ?? 0,
          name: productName,
          type: productType,
          criticalSupplyType,
        },
        item.quantity,
        recipesByProduct,
        item.recipeSnapshot
      );
    }
  }
}

async function finalizeSummary(
  state: SummaryState,
  branchId: number,
  dbOrTx: typeof db
) {
  const total = addMoney(state.cashTotal, state.transferTotal);

  const criticalSupplies = await productRepository.findActiveCriticalSupplies(
    branchId,
    dbOrTx
  );

  fillMissingCriticalSupplies(state.criticalSuppliesSummary, criticalSupplies);

  return {
    total: moneyToNumber(total),
    cashTotal: moneyToNumber(state.cashTotal),
    transferTotal: moneyToNumber(state.transferTotal),
    totalSales: state.totalSales,
    productsSummary: state.productsSummary,
    criticalSuppliesSummary: state.criticalSuppliesSummary,
  };
}

export async function calculateSummaryFromSales(
  branchId: number,
  activeSales: SaleWithItems[],
  dbOrTx: typeof db = db
) {
  const state = createSummaryState();
  const recipesByProduct = new Map<number, RecipeWithSupply[]>();

  await collectMissingRecipes(branchId, activeSales, recipesByProduct, dbOrTx);
  addSalesToSummaryState(state, activeSales, recipesByProduct);

  return finalizeSummary(state, branchId, dbOrTx);
}

/**
 * Variante paginada de `calculateSummaryFromSales`: consume las ventas página
 * a página a través de `loadPage` sin materializar el set completo en
 * memoria. El peak de memoria queda acotado a `pageSize` ventas más los
 * mapas acumulados.
 */
export async function calculatePagedSummaryFromSales(
  branchId: number,
  loadPage: (offset: number, limit: number) => Promise<SaleWithItems[]>,
  options: { pageSize?: number; dbOrTx?: typeof db } = {}
) {
  const dbOrTx = options.dbOrTx ?? db;
  const pageSize = options.pageSize ?? getCashRegisterSummaryPageSize();
  const state = createSummaryState();
  const recipesByProduct = new Map<number, RecipeWithSupply[]>();

  for (let offset = 0; ; offset += pageSize) {
    const sales = await loadPage(offset, pageSize);
    if (sales.length === 0) break;

    await collectMissingRecipes(branchId, sales, recipesByProduct, dbOrTx);
    addSalesToSummaryState(state, sales, recipesByProduct);

    if (sales.length < pageSize) break;
  }

  return finalizeSummary(state, branchId, dbOrTx);
}
