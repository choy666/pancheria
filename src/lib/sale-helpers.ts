import { addMoney, moneyToNumber, multiplyMoney, parseMoney } from '@/lib/money';
import type { ProductRow } from '@/domain/types';

export type SaleItemValue = {
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export function buildSaleItemValues(
  productById: Map<number, ProductRow>,
  items: {
    productId: number;
    quantity: number;
    unitPrice?: number;
    subtotal?: number;
  }[]
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

    saleItemValues.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: moneyToNumber(unitPrice),
      subtotal: moneyToNumber(subtotal),
    });
  }

  return { saleItemValues, total: moneyToNumber(total) };
}
