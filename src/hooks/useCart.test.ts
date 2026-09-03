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
];

function getAvailability(productId: number) {
  const map: Record<number, number> = { 1: 5, 2: 10 };
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
});
