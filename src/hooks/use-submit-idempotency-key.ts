import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { PaymentPart } from '@/domain/types';

/**
 * Clave de idempotencia por intento de submit (corrección del hallazgo
 * QA-2026-09-21-02).
 *
 * El servidor compara una huella canónica: la misma clave y el mismo payload
 * recuperan el recurso creado; la misma clave con datos distintos responde
 * 409. `resolve(signature)` conserva la clave entre reintentos idénticos y
 * la rota cuando cambia cualquier dato relevante. `reset()` descarta la clave
 * actual tras un submit exitoso.
 */
export function useSubmitIdempotencyKey() {
  const current = useRef<{ signature: string; key: string } | null>(null);

  const resolve = useCallback((signature: string): string => {
    if (!current.current || current.current.signature !== signature) {
      current.current = { signature, key: nanoid() };
    }
    return current.current.key;
  }, []);

  const reset = useCallback(() => {
    current.current = null;
  }, []);

  return { resolve, reset };
}

/**
 * Firma estable del carrito, independiente del orden de las líneas y de las
 * opciones seleccionadas. Reordenar las mismas líneas no rota la clave.
 */
export function cartSignature(
  items: {
    productId: number;
    quantity: number;
    selectedRecipeItemIds?: number[];
  }[]
): string {
  return items
    .map(
      (item) =>
        `${item.productId}:${item.quantity}:${[...(item.selectedRecipeItemIds ?? [])]
          .sort((a, b) => a - b)
          .join(',')}`
    )
    .sort()
    .join('|');
}

export function saleSignature(
  items: Parameters<typeof cartSignature>[0],
  payments: PaymentPart[]
): string {
  return JSON.stringify({
    items: cartSignature(items),
    payments: payments.map(({ method, amount }) => ({ method, amount })),
  });
}

export function orderConfirmationSignature(
  orderId: number,
  payments: PaymentPart[]
): string {
  return JSON.stringify({
    orderId,
    payments: payments.map(({ method, amount }) => ({ method, amount })),
  });
}

export function checkoutSignature(
  items: Parameters<typeof cartSignature>[0],
  deliveryType: string,
  address?: string,
  customerName = '',
  customerPhone = '',
  notes = ''
): string {
  return JSON.stringify({
    items: cartSignature(items),
    deliveryType,
    address: deliveryType === 'delivery' ? address?.trim() || null : null,
    customerName: customerName.trim(),
    customerPhone: customerPhone.replace(/\s/g, ''),
    notes: notes.trim() || null,
  });
}
