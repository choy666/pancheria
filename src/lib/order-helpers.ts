import { randomBytes, randomUUID } from 'crypto';
import { nowUTC } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { formatRecipeSummary } from '@/lib/recipe-helpers';
import { getChatMaxTextLength } from '@/config/chat';
import type { SaleItemValue } from '@/lib/sale-helpers';
import type { orderItems } from '@/db/schema';
import type { OrderWithItems, RecipeItemConfig } from '@/domain/types';

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
): typeof orderItems.$inferInsert[] {
  return saleItemValues.map((item) => ({
    orderId,
    productId: item.productId,
    productName: item.productName,
    productType: item.productType,
    criticalSupplyType: item.criticalSupplyType,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    notes: item.notes ?? null,
  }));
}

function formatRecipeItemLine(recipe: RecipeItemConfig[]): string {
  return formatRecipeSummary(recipe);
}

export function toPublicCancelledOrder(
  order: Pick<OrderWithItems, 'id' | 'orderNumber' | 'status' | 'cancelledAt'>
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    cancelledAt: order.cancelledAt,
  };
}

/**
 * Primer mensaje automático del chat del pedido: saludo personalizado y
 * resumen amigable para el cliente (ítems, total y forma de entrega). El
 * detalle operativo de preparación va en un segundo mensaje aparte
 * (`buildRecipeSnapshotMessageContent`).
 */
export function buildOrderWelcomeMessageContent(input: {
  customerName: string;
  branchName: string;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  address?: string | null;
  items: Pick<SaleItemValue, 'productName' | 'quantity'>[];
}): string {
  const name = input.customerName.trim();
  const greeting = name ? `¡Hola, ${name}!` : '¡Hola!';
  const itemLines = input.items.map(
    (item) => `- ${item.productName} x${item.quantity}`
  );
  const deliveryLine =
    input.deliveryType === 'delivery'
      ? `Entrega: envío a domicilio${
          input.address?.trim() ? ` (${input.address.trim()})` : ''
        }`
      : `Entrega: retiro en ${input.branchName}`;

  const content = [
    `${greeting} Recibimos tu pedido en ${input.branchName}:`,
    ...itemLines,
    `Total: ${formatMoney(input.total)}`,
    deliveryLine,
    'Cualquier cosa que necesites, escribinos por acá. ¡Gracias!',
  ].join('\n');

  return content.slice(0, getChatMaxTextLength());
}

export function buildRecipeSnapshotMessageContent(
  saleItemValues: SaleItemValue[]
): string | null {
  const lines = saleItemValues
    .filter(
      (item) =>
        (item.recipeSnapshot && item.recipeSnapshot.length > 0) || item.notes
    )
    .map((item) => {
      const recipePart =
        item.recipeSnapshot && item.recipeSnapshot.length > 0
          ? `: ${formatRecipeItemLine(item.recipeSnapshot)}`
          : '';
      const notePart = item.notes ? ` — Aclaración: ${item.notes}` : '';
      return `${item.productName} x${item.quantity}${recipePart}${notePart}`;
    });

  if (lines.length === 0) return null;

  return `Detalle de preparación:\n${lines.join('\n')}`;
}
