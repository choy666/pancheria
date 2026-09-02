import { randomBytes, randomUUID } from 'crypto';
import { nowUTC } from '@/lib/date';
import { formatRecipeSummary } from '@/lib/recipe-helpers';
import type { SaleItemValue } from '@/lib/sale-helpers';
import type { RecipeItemConfig } from '@/domain/types';

export function generateOrderNumber(branchId: number): string {
  return `PED-${branchId}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function generateCancellationToken(): string {
  return randomBytes(32).toString('hex');
}

export function buildOrderValues(input: {
  branchId: number;
  orderNumber: string;
  total: number;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string | null;
  notes?: string | null;
  cancellationToken: string;
  idempotencyKey: string;
}): {
  branchId: number;
  orderNumber: string;
  total: number;
  status: 'pending';
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  idempotencyKey: string;
  createdAt: Date;
} {
  return {
    branchId: input.branchId,
    orderNumber: input.orderNumber,
    total: input.total,
    status: 'pending',
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.replace(/\s/g, ''),
    deliveryType: input.deliveryType,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    cancellationToken: input.cancellationToken,
    idempotencyKey: input.idempotencyKey,
    createdAt: nowUTC(),
  };
}

export function buildOrderItemValues(
  saleItemValues: SaleItemValue[],
  orderId: number
): {
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}[] {
  return saleItemValues.map((item) => ({
    orderId,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
  }));
}

function formatRecipeItemLine(recipe: RecipeItemConfig[]): string {
  return formatRecipeSummary(recipe);
}

export function buildRecipeSnapshotMessageContent(
  saleItemValues: SaleItemValue[]
): string | null {
  const lines = saleItemValues
    .filter((item) => item.recipeSnapshot && item.recipeSnapshot.length > 0)
    .map((item) =>
      `${item.productName} x${item.quantity}: ${formatRecipeItemLine(
        item.recipeSnapshot ?? []
      )}`
    );

  if (lines.length === 0) return null;

  return `Detalle de preparación:\n${lines.join('\n')}`;
}
