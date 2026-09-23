/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import {
  useSubmitIdempotencyKey,
  cartSignature,
  checkoutSignature,
} from './use-submit-idempotency-key';

describe('useSubmitIdempotencyKey', () => {
  test('conserva la clave mientras la firma no cambie (reintentos)', () => {
    const { result } = renderHook(() => useSubmitIdempotencyKey());

    const first = result.current.resolve('sig-a');
    const second = result.current.resolve('sig-a');

    expect(second).toBe(first);
  });

  test('rota la clave cuando cambia la firma (otro carrito)', () => {
    const { result } = renderHook(() => useSubmitIdempotencyKey());

    const first = result.current.resolve('sig-a');
    const rotated = result.current.resolve('sig-b');

    expect(rotated).not.toBe(first);
  });

  test('rota la clave tras reset (éxito del submit)', () => {
    const { result } = renderHook(() => useSubmitIdempotencyKey());

    const first = result.current.resolve('sig-a');
    result.current.reset();
    const next = result.current.resolve('sig-a');

    expect(next).not.toBe(first);
  });
});

describe('cartSignature', () => {
  const item = (productId: number, quantity: number, recipeIds?: number[]) => ({
    productId,
    quantity,
    selectedRecipeItemIds: recipeIds,
  });

  test('es independiente del orden de las líneas', () => {
    const a = cartSignature([item(1, 2), item(5, 1, [9, 3])]);
    const b = cartSignature([item(5, 1, [3, 9]), item(1, 2)]);

    expect(a).toBe(b);
  });

  test('cambia si cambian cantidades, productos o recetas elegidas', () => {
    const base = [item(1, 2), item(5, 1)];

    expect(cartSignature([item(1, 3), item(5, 1)])).not.toBe(
      cartSignature(base)
    );
    expect(cartSignature([item(1, 2), item(6, 1)])).not.toBe(
      cartSignature(base)
    );
    expect(cartSignature([item(1, 2), item(5, 1, [9])])).not.toBe(
      cartSignature(base)
    );
  });
});

describe('checkoutSignature', () => {
  const item = (productId: number, quantity: number, recipeIds?: number[]) => ({
    productId,
    quantity,
    selectedRecipeItemIds: recipeIds,
  });
  const cart = [item(1, 2), item(5, 1, [9])];

  test('el mismo carrito con una opción distinta produce otra firma', () => {
    expect(
      checkoutSignature([item(1, 2), item(5, 1, [7])], 'pickup')
    ).not.toBe(checkoutSignature(cart, 'pickup'));
  });

  test('cambiar el tipo de entrega produce otra firma', () => {
    expect(checkoutSignature(cart, 'delivery', 'Calle 1')).not.toBe(
      checkoutSignature(cart, 'pickup')
    );
  });

  test('en delivery, cambiar la dirección produce otra firma', () => {
    expect(checkoutSignature(cart, 'delivery', 'Calle 1')).not.toBe(
      checkoutSignature(cart, 'delivery', 'Calle 2')
    );
  });

  test('en pickup la dirección no altera la firma', () => {
    expect(checkoutSignature(cart, 'pickup', 'Calle 1')).toBe(
      checkoutSignature(cart, 'pickup')
    );
  });
});
