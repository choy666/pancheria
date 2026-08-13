/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClockInterval } from './use-clock-interval';

const INTERVAL = 100;

jest.useFakeTimers();

describe('useClockInterval', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  test('devuelve la hora actual', () => {
    const before = new Date();
    const { result } = renderHook(() => useClockInterval(INTERVAL));
    const after = new Date();

    expect(result.current.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.current.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('actualiza la hora periódicamente', async () => {
    const { result } = renderHook(() => useClockInterval(INTERVAL));
    const initial = result.current.getTime();

    act(() => {
      jest.advanceTimersByTime(INTERVAL + 10);
    });

    await waitFor(() => {
      expect(result.current.getTime()).toBeGreaterThan(initial);
    });
  });

  test('pausa el intervalo cuando la pestaña está oculta', async () => {
    const { result } = renderHook(() => useClockInterval(INTERVAL));
    const initial = result.current.getTime();

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(INTERVAL + 10);
    });

    expect(result.current.getTime()).toBe(initial);
  });

  test('reanuda el intervalo al volver a la pestaña', async () => {
    const { result } = renderHook(() => useClockInterval(INTERVAL));
    const initial = result.current.getTime();

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      jest.advanceTimersByTime(INTERVAL + 10);
    });

    await waitFor(() => {
      expect(result.current.getTime()).toBeGreaterThan(initial);
    });
  });
});
