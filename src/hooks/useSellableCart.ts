import { useCallback, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  areRecipeSelectionsEqual,
  getDefaultSelectedRecipeItemIds,
  hasOptionalRecipeItems,
} from '@/lib/cart-helpers';
import type { ProductType } from '@/domain/types';

/**
 * Producto mínimo que admite ser vendido a través del carrito compartido.
 *
 * `CartProduct` y `SellableProduct` satisfacen esta interfaz estructural,
 * por lo que `useSellableCart` puede usarse en el flujo público y en el
 * terminal de ventas sin acoplarse a sus tipos concretos.
 */
export interface SellableCartProduct {
  id: number;
  name: string;
  price: number;
  unit: string;
  type: ProductType;
  recipe?: {
    isOptional: boolean;
    selectedByDefault: boolean;
    supplyId: number;
  }[];
}

export interface SellableCartLine<TProduct extends SellableCartProduct> {
  lineId: string;
  product: TProduct;
  quantity: number;
  selectedRecipeItemIds: number[];
}

interface UseSellableCartOptions<
  TProduct extends SellableCartProduct,
> {
  /**
   * Disponibilidad total del producto (no adicional).
   *
   * Recibe el estado pendiente de las líneas para que los consumidores que
   * calculan disponibilidad de forma asíncrona puedan alinear el total con el
   * carrito que se está por aplicar.
   */
  getAvailability: (
    productId: number,
    currentLines?: SellableCartLine<TProduct>[]
  ) => number;
  /** Líneas iniciales del carrito. Útil para restaurar desde localStorage. */
  initialLines?: SellableCartLine<TProduct>[];
  /** Llamado cuando un producto no puede agregarse por falta de stock. */
  onOutOfStock?: (product: TProduct) => void;
}

function isServiceProduct(product: SellableCartProduct): boolean {
  return product.type === 'service';
}

function getTotalQuantityForProduct<TProduct extends SellableCartProduct>(
  lines: SellableCartLine<TProduct>[],
  productId: number,
  excludeLineId?: string
): number {
  return lines
    .filter(
      (item) =>
        item.product.id === productId && item.lineId !== excludeLineId
    )
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function useSellableCart<TProduct extends SellableCartProduct>({
  getAvailability,
  initialLines = [],
  onOutOfStock,
}: UseSellableCartOptions<TProduct>) {
  const [lines, setLines] = useState<SellableCartLine<TProduct>[]>(initialLines);

  const addItem = useCallback(
    (product: TProduct, selectedRecipeItemIds?: number[]) => {
      const isService = isServiceProduct(product);
      const resolvedSelected =
        selectedRecipeItemIds ?? getDefaultSelectedRecipeItemIds(product);

      setLines((prev) => {
        const availability = getAvailability(product.id, prev);

        // Los productos personalizables nunca se fusionan: cada unidad ocupa
        // su propia línea para poder personalizarla por separado.
        if (!hasOptionalRecipeItems(product)) {
          const existing = prev.find(
            (item) =>
              item.product.id === product.id &&
              areRecipeSelectionsEqual(
                item.selectedRecipeItemIds,
                resolvedSelected
              )
          );

          if (existing) {
            const otherQuantity = getTotalQuantityForProduct(
              prev,
              product.id,
              existing.lineId
            );
            const max = isService
              ? Number.MAX_SAFE_INTEGER
              : availability - otherQuantity;
            const nextQuantity = Math.min(existing.quantity + 1, max);

            if (!isService && nextQuantity <= existing.quantity) return prev;

            return prev.map((item) =>
              item.lineId === existing.lineId
                ? { ...item, quantity: nextQuantity }
                : item
            );
          }
        }

        const otherQuantity = getTotalQuantityForProduct(prev, product.id);
        const max = isService
          ? Number.MAX_SAFE_INTEGER
          : availability - otherQuantity;

        if (!isService && max <= 0) {
          onOutOfStock?.(product);
          return prev;
        }

        return [
          ...prev,
          {
            lineId: nanoid(),
            product,
            quantity: 1,
            selectedRecipeItemIds: resolvedSelected,
          },
        ];
      });
    },
    [getAvailability, onOutOfStock]
  );

  const removeItem = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((item) => item.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(lineId);
        return;
      }

      setLines((prev) => {
        const item = prev.find((i) => i.lineId === lineId);
        if (!item) return prev;

        const isService = isServiceProduct(item.product);
        const availability = getAvailability(item.product.id, prev);
        const otherQuantity = getTotalQuantityForProduct(
          prev,
          item.product.id,
          lineId
        );
        const max = isService
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, availability - otherQuantity);
        const nextQuantity = isService
          ? quantity
          : Math.min(quantity, max);

        if (!isService && nextQuantity <= 0) {
          return prev.filter((i) => i.lineId !== lineId);
        }

        return prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: nextQuantity } : i
        );
      });
    },
    [getAvailability, removeItem]
  );

  const updateSelectedRecipeItemIds = useCallback(
    (lineId: string, selectedRecipeItemIds: number[]) => {
      setLines((prev) =>
        prev.map((item) =>
          item.lineId === lineId
            ? { ...item, selectedRecipeItemIds }
            : item
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setLines([]);
  }, []);

  const total = useMemo(
    () => lines.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [lines]
  );

  return {
    lines,
    setLines,
    total,
    addItem,
    removeItem,
    updateQuantity,
    updateSelectedRecipeItemIds,
    clearCart,
  };
}
