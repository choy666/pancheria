import { randomBytes, randomUUID } from 'crypto';
import { nowUTC } from '@/lib/date';
import type { SaleItemValue } from '@/lib/sale-helpers';

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
    ...item,
    orderId,
  }));
}
