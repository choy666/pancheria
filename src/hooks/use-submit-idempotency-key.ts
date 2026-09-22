import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';

/**
 * Clave de idempotencia por intento de submit (corrección del hallazgo
 * QA-2026-09-21-02).
 *
 * El servidor deduplica pedidos y ventas por `(branchId, idempotencyKey)`
 * sin comparar el payload: si la clave se repite, devuelve el recurso ya
 * creado. Para que esa deduplicación cubra el vector real de duplicados
 * —un reintento del usuario cuando la request llegó al servidor pero la
 * respuesta se perdió— la clave debe conservarse entre reintentos.
 *
 * `resolve(signature)` devuelve siempre la misma clave mientras la firma
 * no cambie; rota la clave cuando la firma cambia (otro carrito u otra
 * operación). `reset()` descarta la clave actual: debe llamarse tras un
 * submit exitoso para que la próxima operación empiece con clave nueva.
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
 * Firma estable del carrito para la clave de idempotencia: independiente
 * del orden de las líneas. Un cambio de carrito rota la clave (el
 * servidor devolvería el pedido original si se reutilizara la clave con
 * otro payload); reordenar las mismas líneas no la rota.
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

/**
 * Firma del pedido público: el carrito más el tipo de entrega y, en
 * `delivery`, la dirección. Cambiar de retiro a envío (o el destino) es
 * otro pedido y debe rotar la clave — el servidor devolvería el pedido
 * original si se reutilizara. Nombre, teléfono y notas no entran en la
 * firma: son metadatos del mismo intento de compra; corregirlos y
 * reintentar debe deduplicar (el servidor devuelve lo ya registrado).
 */
export function checkoutSignature(
  items: Parameters<typeof cartSignature>[0],
  deliveryType: string,
  address?: string
): string {
  const deliveryPart =
    deliveryType === 'delivery' ? (address ?? '').trim().toLowerCase() : '';
  return `${cartSignature(items)}|${deliveryType}|${deliveryPart}`;
}
