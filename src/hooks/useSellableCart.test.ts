/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useSellableCart, type SellableCartProduct } from './useSellableCart';

const products: SellableCartProduct[] = [
  { id: 1, name: 'Panchuque', price: 1200, unit: 'unidad', type: 'compound' },
  { id: 2, name: 'Gaseosa', price: 500, unit: 'unidad', type: 'critical_supply' },
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
        isOptional: true,
        selectedByDefault: true,
      },
    ],
  },
];

function makeAvailability(map: Record<number, number>) {
  return (productId: number) => map[productId] ?? 0;
}

describe('useSellableCart', () => {
  test('inicia vacío con total 0', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    expect(result.current.lines).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  test('agregar un producto crea una línea', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      result.current.addItem(products[0]);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(1);
    expect(result.current.total).toBe(1200);
  });

  test('agregar el mismo producto con selecciones iguales fusiona líneas', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 10 }) })
    );

    act(() => {
      result.current.addItem(products[0], [1, 2]);
      result.current.addItem(products[0], [2, 1]);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(2);
    expect(result.current.total).toBe(2400);
  });

  test('agregar el mismo producto con selecciones distintas crea dos líneas', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 10 }) })
    );

    act(() => {
      result.current.addItem(products[0], [1]);
      result.current.addItem(products[0], [2]);
    });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.total).toBe(2400);
  });

  test('respeta el límite de disponibilidad al incrementar', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      for (let i = 0; i < 6; i++) {
        result.current.addItem(products[0]);
      }
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(5);
  });

  test('los servicios no tienen límite de cantidad', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 3: 0 }) })
    );

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addItem(products[2]);
      }
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(10);
  });

  test('actualizar cantidad la incrementa y elimina en 0', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      result.current.addItem(products[0]);
    });

    const lineId = result.current.lines[0].lineId;

    act(() => {
      result.current.updateQuantity(lineId, 3);
    });

    expect(result.current.lines[0].quantity).toBe(3);

    act(() => {
      result.current.updateQuantity(lineId, 0);
    });

    expect(result.current.lines).toEqual([]);
  });

  test('updateQuantity respeta el límite de disponibilidad', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      result.current.addItem(products[0]);
    });

    const lineId = result.current.lines[0].lineId;

    act(() => {
      result.current.updateQuantity(lineId, 10);
    });

    expect(result.current.lines[0].quantity).toBe(5);
  });

  test('removeItem elimina solo la línea indicada', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 10 }) })
    );

    act(() => {
      result.current.addItem(products[0], [1]);
      result.current.addItem(products[0], [2]);
    });

    const firstLineId = result.current.lines[0].lineId;

    act(() => {
      result.current.removeItem(firstLineId);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].lineId).not.toBe(firstLineId);
  });

  test('updateSelectedRecipeItemIds cambia la selección de una línea', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 10 }) })
    );

    act(() => {
      result.current.addItem(products[0], [1]);
    });

    const lineId = result.current.lines[0].lineId;

    act(() => {
      result.current.updateSelectedRecipeItemIds(lineId, [2, 3]);
    });

    expect(result.current.lines[0].selectedRecipeItemIds).toEqual([2, 3]);
  });

  test('clearCart vacía el carrito', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      result.current.addItem(products[0]);
    });

    act(() => {
      result.current.clearCart();
    });

    expect(result.current.lines).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  test('los productos personalizables no se fusionan: cada agregado crea una línea', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 4: 10 }) })
    );

    act(() => {
      result.current.addItem(products[3], [10]);
      result.current.addItem(products[3], [10]);
    });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.lines[0].quantity).toBe(1);
    expect(result.current.lines[1].quantity).toBe(1);
  });

  test('los productos personalizables respetan el stock total entre líneas', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 4: 3 }) })
    );

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addItem(products[3]);
      }
    });

    expect(result.current.lines).toHaveLength(3);
    expect(
      result.current.lines.every((line) => line.quantity === 1)
    ).toBe(true);
  });

  test('agregar en múltiples líneas respeta el stock total', () => {
    const { result } = renderHook(() =>
      useSellableCart({ getAvailability: makeAvailability({ 1: 5 }) })
    );

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addItem(products[0], [1]);
      }
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(5);

    act(() => {
      result.current.addItem(products[0], [2]);
    });

    expect(result.current.lines).toHaveLength(1);
  });

  test('llama onOutOfStock cuando no se puede agregar por falta de stock', () => {
    const onOutOfStock = jest.fn();
    const { result } = renderHook(() =>
      useSellableCart({
        getAvailability: makeAvailability({ 1: 0 }),
        onOutOfStock,
      })
    );

    act(() => {
      result.current.addItem(products[0]);
    });

    expect(onOutOfStock).toHaveBeenCalledTimes(1);
    expect(onOutOfStock).toHaveBeenCalledWith(products[0]);
    expect(result.current.lines).toEqual([]);
  });
});
