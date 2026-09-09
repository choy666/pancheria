import { useCallback, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { hasOptionalRecipeItems } from '@/lib/cart-helpers';
import { useSellableCart, type SellableCartLine } from './useSellableCart';
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

function cartProductFromItem(item: CartItem): CartProduct {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    unit: item.unit,
    type: item.type,
    criticalSupplyType: item.criticalSupplyType,
    recipe: item.recipe,
  };
}

function lineToCartItem(line: SellableCartLine<CartProduct>): CartItem {
  return {
    ...line.product,
    lineId: line.lineId,
    quantity: line.quantity,
    selectedRecipeItemIds: line.selectedRecipeItemIds,
  };
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
      .flatMap((item) => {
        const product = productById.get(item.id);
        if (!product) return [];

        const availability = getAvailability(item.id);
        const isService = product.type === 'service';
        const max = isService ? Number.MAX_SAFE_INTEGER : availability;
        const quantity = isService
          ? item.quantity
          : Math.min(item.quantity, Math.max(0, max));

        if (!isService && quantity <= 0) return [];

        // Las líneas personalizables guardadas con el modelo anterior
        // (varias unidades agrupadas) se expanden en una línea por unidad.
        if (hasOptionalRecipeItems(product) && quantity > 1) {
          return Array.from({ length: quantity }, () => ({
            ...product,
            lineId: nanoid(),
            quantity: 1,
            selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
          }));
        }

        return [
          {
            ...product,
            lineId: item.lineId ?? nanoid(),
            quantity,
            selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
          },
        ];
      });
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
  const {
    lines,
    setLines,
    total: cartTotal,
    addItem: addLine,
    removeItem: removeLine,
    updateQuantity: updateLineQuantity,
    updateSelectedRecipeItemIds: updateLineSelection,
    clearCart: clearLines,
  } = useSellableCart<CartProduct>({ getAvailability });

  const previousBranchIdRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);

  // Inicializamos con un arreglo vacío para que el primer render coincida
  // entre SSR y cliente. Esto evita errores de hydration cuando el carrito
  // se persiste en localStorage y se restaura en el cliente.
  // Si el usuario ya interactuó antes de que este efecto corra (por ejemplo,
  // un click muy rápido en E2E), no pise el carrito que ya armó.
  useEffect(() => {
    if (previousBranchIdRef.current === branchId) return;

    const isInitialLoad = previousBranchIdRef.current === null;
    previousBranchIdRef.current = branchId;

    if (isInitialLoad && userInteractedRef.current) {
      return;
    }

    const initialItems = getInitialItems(branchId, products, getAvailability);
    setLines(
      initialItems.map((item) => ({
        lineId: item.lineId,
        product: cartProductFromItem(item),
        quantity: item.quantity,
        selectedRecipeItemIds: item.selectedRecipeItemIds,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const storage = getStorage();

    if (lines.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    const stored = {
      version: 'pancheria-cart-v1' as const,
      branchId,
      items: lines.map(lineToCartItem),
    };

    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [lines, branchId]);

  const items = useMemo<CartItem[]>(
    () => lines.map((line) => lineToCartItem(line)),
    [lines]
  );

  const total = cartTotal;

  const addItem = useCallback(
    (product: CartProduct, selectedRecipeItemIds?: number[]) => {
      userInteractedRef.current = true;
      addLine(product, selectedRecipeItemIds);
    },
    [addLine]
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      userInteractedRef.current = true;
      updateLineQuantity(lineId, quantity);
    },
    [updateLineQuantity]
  );

  const removeItem = useCallback(
    (lineId: string) => {
      userInteractedRef.current = true;
      removeLine(lineId);
    },
    [removeLine]
  );

  const updateSelectedRecipeItemIds = useCallback(
    (lineId: string, selectedRecipeItemIds: number[]) => {
      userInteractedRef.current = true;
      updateLineSelection(lineId, selectedRecipeItemIds);
    },
    [updateLineSelection]
  );

  const clearCart = useCallback(() => {
    userInteractedRef.current = true;
    clearLines();
  }, [clearLines]);

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
