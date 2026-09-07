/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCart, type CartProduct } from './useCart';

const STORAGE_KEY = 'pancheria-cart-v1';

const products: CartProduct[] = [
  { id: 1, name: 'Panchuque', price: 1200, unit: 'unidad', type: 'compound' },
  { id: 2, name: 'Gaseosa', price: 500, unit: 'unidad', type: 'critical_supply', criticalSupplyType: 'beverage' },
  { id: 3, name: 'Envío', price: 0, unit: 'unidad', type: 'service' },
  {
    id: 4,
    name: 'Promo personalizable',
    price: 2000,
    unit: 'unidad',
    type: 'compound',
    recipe: [
      {
        supplyId: 10,
        supplyName: 'Ketchup',
        supplyType: 'manual_supply',
        quantity: 1,
        autoDiscount: false,
        isOptional: true,
        selected: true,
        selectedByDefault: true,
      },
    ],
  },
];

function getAvailability(productId: number) {
  const map: Record<number, number> = { 1: 5, 2: 10, 4: 3 };
  return map[productId] ?? 0;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('useCart', () => {
  test('inicia vacío y permite agregar productos', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.addItem(products[0]);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.total).toBe(1200);
  });

  test('respeta el límite de disponibilidad al aumentar la cantidad', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
    });

    expect(result.current.items[0].quantity).toBe(5);
  });

  test('los servicios no tienen límite de cantidad', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addItem(products[2]);
      }
    });

    expect(result.current.items[0].quantity).toBe(10);
  });

  test('permite actualizar y eliminar cantidades', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[0]);
      result.current.addItem(products[0]);
    });

    const lineId = result.current.items[0].lineId;

    act(() => {
      result.current.updateQuantity(lineId, 5);
    });

    expect(result.current.items[0].quantity).toBe(5);

    act(() => {
      result.current.updateQuantity(lineId, 0);
    });

    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.removeItem(lineId);
    });

    expect(result.current.items).toEqual([]);
  });

  test('persiste y restaura el carrito desde localStorage', async () => {
    const stored = {
      version: 'pancheria-cart-v1',
      branchId: 1,
      items: [{ ...products[0], quantity: 3 }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(result.current.items[0].quantity).toBe(3);
  });

  test('limpia el carrito si la sucursal guardada no coincide', async () => {
    const stored = {
      version: 'pancheria-cart-v1',
      branchId: 99,
      items: [{ ...products[0], quantity: 3 }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('descarta productos que ya no están en el catálogo', async () => {
    const stored = {
      version: 'pancheria-cart-v1',
      branchId: 1,
      items: [
        { ...products[0], quantity: 1 },
        { id: 999, name: 'Viejo', price: 100, unit: 'unidad', type: 'service', quantity: 1 },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    expect(result.current.items[0].id).toBe(1);
  });

  test('limpia el carrito al cambiar de sucursal en tiempo de ejecución', async () => {
    const stored = {
      version: 'pancheria-cart-v1',
      branchId: 1,
      items: [{ ...products[0], quantity: 3 }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result, rerender } = renderHook(
      ({ branchId }) => useCart({ branchId, products, getAvailability }),
      {
        initialProps: { branchId: 1, products, getAvailability },
      }
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({ branchId: 2, products, getAvailability });

    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('dos agregados del mismo producto con selecciones distintas crean dos líneas', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[0], [1]);
      result.current.addItem(products[0], [2]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(2400);
  });

  test('dos agregados del mismo producto con selecciones iguales unen en una línea', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[0], [1, 2]);
      result.current.addItem(products[0], [2, 1]);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  test('removeItem elimina solo la línea indicada', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[0], [1]);
      result.current.addItem(products[0], [2]);
    });

    const firstLineId = result.current.items[0].lineId;

    act(() => {
      result.current.removeItem(firstLineId);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].lineId).not.toBe(firstLineId);
  });

  test('agregar el mismo producto en múltiples líneas respeta el stock total', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      // Cinco unidades con selección [1]
      for (let i = 0; i < 5; i++) {
        result.current.addItem(products[0], [1]);
      }
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);

    act(() => {
      // No se puede agregar otra selección porque se agotó el stock.
      result.current.addItem(products[0], [2]);
    });

    expect(result.current.items).toHaveLength(1);
  });

  test('los productos personalizables no se fusionan: cada agregado crea una línea', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      result.current.addItem(products[3], [10]);
      result.current.addItem(products[3], [10]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.items[1].quantity).toBe(1);
    expect(result.current.items[0].lineId).not.toBe(
      result.current.items[1].lineId
    );
  });

  test('los productos personalizables respetan el stock total entre líneas', async () => {
    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addItem(products[3]);
      }
    });

    // Disponibilidad 3: solo se crean 3 líneas de una unidad.
    expect(result.current.items).toHaveLength(3);
    expect(
      result.current.items.every((item) => item.quantity === 1)
    ).toBe(true);
  });

  test('restaura líneas personalizables agrupadas expandiéndolas por unidad', async () => {
    const stored = {
      version: 'pancheria-cart-v1',
      branchId: 1,
      items: [
        { ...products[3], quantity: 2, selectedRecipeItemIds: [10] },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() =>
      useCart({ branchId: 1, products, getAvailability })
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(
      result.current.items.every(
        (item) => item.quantity === 1 && item.id === 4
      )
    ).toBe(true);
  });
});
