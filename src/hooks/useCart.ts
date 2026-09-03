import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { areRecipeSelectionsEqual } from '@/lib/cart-helpers';
import type {
  CriticalSupplyType,
  ProductType,
  RecipeItemConfig,
} from '@/domain/types';

export interface CartProduct {
  id: number;
  name: string;
  price: number;
  unit: string;
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType | null;
  recipe?: RecipeItemConfig[];
}

export interface CartItem extends CartProduct {
  lineId: string;
  quantity: number;
  selectedRecipeItemIds: number[];
}

const cartItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  price: z.number().nonnegative(),
  unit: z.string(),
  type: z.enum(['critical_supply', 'compound', 'manual_supply', 'service']),
  criticalSupplyType: z
    .enum(['bread', 'sausage', 'beverage'])
    .nullable()
    .optional(),
  lineId: z.string().optional(),
  quantity: z.number().int().positive(),
  selectedRecipeItemIds: z.array(z.number().int().positive()).default([]),
});

const storedCartSchema = z.object({
  version: z.literal('pancheria-cart-v1'),
  branchId: z.number().int().positive(),
  items: z.array(cartItemSchema),
});

function getDefaultSelectedRecipeItemIds(
  product: CartProduct
): number[] {
  return (
    product.recipe
      ?.filter((item) => item.isOptional && item.selectedByDefault)
      .map((item) => item.supplyId) ?? []
  );
}

const STORAGE_KEY = 'pancheria-cart-v1';

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  } as Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

function getInitialItems(
  branchId: number,
  products: CartProduct[],
  getAvailability: (productId: number) => number
): CartItem[] {
  const storage = getStorage();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const stored = storedCartSchema.safeParse(parsed);

    if (!stored.success || stored.data.branchId !== branchId) {
      return [];
    }

    const productById = new Map(products.map((p) => [p.id, p]));

    return stored.data.items
      .map((item) => {
        const product = productById.get(item.id);
        if (!product) return null;

        const availability = getAvailability(item.id);
        const isService = product.type === 'service';
        const max = isService ? Number.MAX_SAFE_INTEGER : availability;
        const quantity = isService
          ? item.quantity
          : Math.min(item.quantity, Math.max(0, max));

        if (!isService && quantity <= 0) return null;

        return {
          ...product,
          lineId: item.lineId ?? nanoid(),
          quantity,
          selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
        };
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export interface UseCartOptions {
  branchId: number;
  products: CartProduct[];
  getAvailability: (productId: number) => number;
}

export function useCart({
  branchId,
  products,
  getAvailability,
}: UseCartOptions) {
  // Inicializamos con un arreglo vacío para que el primer render coincida
  // entre SSR y cliente. Esto evita errores de hydration cuando el carrito
  // se persiste en localStorage y se restaura en el cliente.
  const [items, setItems] = useState<CartItem[]>([]);
  const previousBranchIdRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);

  // Carga inicial y reinicialización al cambiar de sucursal. Se ejecuta en
  // un efecto porque localStorage no está disponible durante el render del
  // servidor y no queremos que el HTML inicial dependa de él.
  // Si el usuario ya interactuó antes de que este efecto corra (por ejemplo,
  // un click muy rápido en E2E), no pise el carrito que ya armó.
  useEffect(() => {
    if (previousBranchIdRef.current === branchId) return;

    const isInitialLoad = previousBranchIdRef.current === null;
    previousBranchIdRef.current = branchId;

    if (isInitialLoad && userInteractedRef.current) {
      return;
    }

    setItems(getInitialItems(branchId, products, getAvailability));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const storage = getStorage();

    if (items.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    const stored = {
      version: 'pancheria-cart-v1' as const,
      branchId,
      items,
    };

    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addItem = useCallback(
    (product: CartProduct, selectedRecipeItemIds?: number[]) => {
      userInteractedRef.current = true;
      const isService = product.type === 'service';
      const availability = getAvailability(product.id);

      if (!isService && availability <= 0) return;

      const resolvedSelected =
        selectedRecipeItemIds ?? getDefaultSelectedRecipeItemIds(product);

      setItems((prev) => {
        const existing = prev.find(
          (item) =>
            item.id === product.id &&
            areRecipeSelectionsEqual(
              item.selectedRecipeItemIds,
              resolvedSelected
            )
        );

        if (existing) {
          const max = isService ? Number.MAX_SAFE_INTEGER : availability;
          const nextQuantity = Math.min(existing.quantity + 1, max);

          if (!isService && nextQuantity <= existing.quantity) return prev;

          return prev.map((item) =>
            item.lineId === existing.lineId
              ? { ...item, quantity: nextQuantity }
              : item
          );
        }

        return [
          ...prev,
          {
            ...product,
            lineId: nanoid(),
            quantity: 1,
            selectedRecipeItemIds: resolvedSelected,
          },
        ];
      });
    },
    [getAvailability]
  );

  const updateSelectedRecipeItemIds = useCallback(
    (lineId: string, selectedRecipeItemIds: number[]) => {
      userInteractedRef.current = true;
      setItems((prev) =>
        prev.map((item) =>
          item.lineId === lineId
            ? { ...item, selectedRecipeItemIds }
            : item
        )
      );
    },
    []
  );

  const removeItem = useCallback((lineId: string) => {
    userInteractedRef.current = true;
    setItems((prev) => prev.filter((item) => item.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      userInteractedRef.current = true;
      if (quantity <= 0) {
        removeItem(lineId);
        return;
      }

      setItems((prev) => {
        const item = prev.find((i) => i.lineId === lineId);
        if (!item) return prev;

        const isService = item.type === 'service';
        const availability = getAvailability(item.id);
        const max = isService ? Number.MAX_SAFE_INTEGER : availability;
        const nextQuantity = isService
          ? quantity
          : Math.min(quantity, Math.max(0, max));

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

  const clearCart = useCallback(() => {
    userInteractedRef.current = true;
    setItems([]);
  }, []);

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    items,
    total,
    addItem,
    removeItem,
    updateQuantity,
    updateSelectedRecipeItemIds,
    clearCart,
  };
}
