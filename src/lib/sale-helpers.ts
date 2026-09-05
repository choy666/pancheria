import { addMoney, moneyToNumber, multiplyMoney, parseMoney } from '@/lib/money';
import { buildRecipeSnapshot } from '@/lib/product-helpers';
import type { ProductRow, RecipeItemConfig } from '@/domain/types';
import type { RecipeWithSupply } from '@/lib/recipe-helpers';

export type SaleItemValue = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  recipeSnapshot?: RecipeItemConfig[];
};

export function buildSaleItemValues(
  productById: Map<number, ProductRow>,
  items: {
    productId: number;
    quantity: number;
    unitPrice?: number;
    subtotal?: number;
    selectedRecipeItemIds?: number[];
    recipeSnapshot?: RecipeItemConfig[];
  }[],
  recipesByProduct?: Map<number, RecipeWithSupply[]>
): {
  saleItemValues: SaleItemValue[];
  total: number;
} {
  let total = parseMoney(0);
  const saleItemValues: SaleItemValue[] = [];

  for (const item of items) {
    const product = productById.get(item.productId)!;
    const unitPrice = parseMoney(item.unitPrice ?? product.price);
    const subtotal =
      item.subtotal !== undefined
        ? parseMoney(item.subtotal)
        : multiplyMoney(unitPrice, item.quantity);
    total = addMoney(total, subtotal);

    let recipeSnapshot: RecipeItemConfig[] | undefined;
    if (item.recipeSnapshot) {
      recipeSnapshot = item.recipeSnapshot;
    } else if (recipesByProduct && product.type === 'compound') {
      const recipeList = recipesByProduct.get(product.id) ?? [];
      recipeSnapshot = buildRecipeSnapshot(
        recipeList,
        item.selectedRecipeItemIds ?? []
      );
    }

    saleItemValues.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: moneyToNumber(unitPrice),
      subtotal: moneyToNumber(subtotal),
      recipeSnapshot,
    });
  }

  return { saleItemValues, total: moneyToNumber(total) };
}
