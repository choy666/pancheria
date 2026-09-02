/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { usePaymentParts } from './usePaymentParts';

describe('usePaymentParts', () => {
  test('inicia con el pago por defecto', () => {
    const { result } = renderHook(() => usePaymentParts(1500));
    expect(result.current.paymentParts).toEqual([
      { method: 'cash', amount: 1500 },
    ]);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.remaining).toBe(0);
  });

  test('mantiene un pago parcial cuando fallbackOnInvalid es false', () => {
    const { result } = renderHook(() => usePaymentParts(1500));

    act(() => {
      result.current.setPayments([{ method: 'cash', amount: 1000 }]);
    });

    expect(result.current.paymentParts).toEqual([
      { method: 'cash', amount: 1000 },
    ]);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.remaining).toBe(500);
  });

  test('vuelve al pago por defecto cuando el monto no cuadra y fallbackOnInvalid es true', () => {
    const { result } = renderHook(() =>
      usePaymentParts(1500, { fallbackOnInvalid: true })
    );

    act(() => {
      result.current.setPayments([{ method: 'cash', amount: 1000 }]);
    });

    expect(result.current.paymentParts).toEqual([
      { method: 'cash', amount: 1500 },
    ]);
  });

  test('redistribuye proporcionalmente cuando cambia el total', () => {
    const { result, rerender } = renderHook(
      ({ total }) => usePaymentParts(total, { redistributeOnTotalChange: true }),
      { initialProps: { total: 1500 } }
    );

    act(() => {
      result.current.setPayments([
        { method: 'cash', amount: 1000 },
        { method: 'transfer', amount: 500 },
      ]);
    });

    rerender({ total: 3000 });

    expect(result.current.paymentParts).toEqual([
      { method: 'cash', amount: 2000 },
      { method: 'transfer', amount: 1000 },
    ]);
    expect(result.current.isComplete).toBe(true);
  });

  test('detecta pago mixto', () => {
    const { result } = renderHook(() => usePaymentParts(1500));

    act(() => {
      result.current.setPayments([
        { method: 'cash', amount: 1000 },
        { method: 'transfer', amount: 500 },
      ]);
    });

    expect(result.current.isMixed).toBe(true);
    expect(result.current.isComplete).toBe(true);
  });

  test('redondea totales con decimales', () => {
    const { result } = renderHook(() => usePaymentParts(1500.7));
    expect(result.current.total).toBe(1501);
    expect(result.current.paymentParts).toEqual([
      { method: 'cash', amount: 1501 },
    ]);
  });
});
