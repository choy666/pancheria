import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { CriticalSupplyType, ProductType } from '@/domain/types';

export interface CartProduct {
  id: number;
  name: string;
  price: number;
  unit: string;
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType | null;
}

export interface CartItem extends CartProduct {
  quantity: number;
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
  quantity: z.number().int().positive(),
});

const storedCartSchema = z.object({
  version: z.literal('pancheria-cart-v1'),
  branchId: z.number().int().positive(),
  items: z.array(cartItemSchema),
});

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

        return { ...product, quantity };
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
  const [items, setItems] = useState<CartItem[]>(
    () => getInitialItems(branchId, products, getAvailability)
  );
  const previousBranchIdRef = useRef(branchId);

  // Si cambia la sucursal en tiempo de ejecución, reinicializamos el carrito
  // desde el storage o lo descartamos si no coincide con la sucursal actual.
  useEffect(() => {
    if (previousBranchIdRef.current === branchId) return;
    previousBranchIdRef.current = branchId;
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
    (product: CartProduct) => {
      const isService = product.type === 'service';
      const availability = getAvailability(product.id);

      if (!isService && availability <= 0) return;

      setItems((prev) => {
        const existing = prev.find((item) => item.id === product.id);

        if (existing) {
          const max = isService ? Number.MAX_SAFE_INTEGER : availability;
          const nextQuantity = Math.min(existing.quantity + 1, max);

          if (!isService && nextQuantity <= existing.quantity) return prev;

          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: nextQuantity }
              : item
          );
        }

        return [...prev, { ...product, quantity: 1 }];
      });
    },
    [getAvailability]
  );

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }

      setItems((prev) => {
        const item = prev.find((i) => i.id === productId);
        if (!item) return prev;

        const isService = item.type === 'service';
        const availability = getAvailability(productId);
        const max = isService ? Number.MAX_SAFE_INTEGER : availability;
        const nextQuantity = isService
          ? quantity
          : Math.min(quantity, Math.max(0, max));

        if (!isService && nextQuantity <= 0) {
          return prev.filter((i) => i.id !== productId);
        }

        return prev.map((i) =>
          i.id === productId ? { ...i, quantity: nextQuantity } : i
        );
      });
    },
    [getAvailability, removeItem]
  );

  const clearCart = useCallback(() => {
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
    clearCart,
  };
}
