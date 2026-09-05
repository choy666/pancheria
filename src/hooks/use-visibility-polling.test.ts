/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useVisibilityPolling } from './use-visibility-polling';

const INTERVAL = 100;

jest.useFakeTimers();

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

describe('useVisibilityPolling', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  test('llama al callback inmediatamente al montar si la pestaña es visible', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('no llama al callback al montar si la pestaña está oculta', () => {
    setHidden(true);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL));

    expect(callback).not.toHaveBeenCalled();
  });

  test('ejecuta el callback periódicamente mientras la pestaña es visible', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL));

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(INTERVAL);
    });
    expect(callback).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(INTERVAL);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('pausa el intervalo cuando la pestaña se oculta', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL));

    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      jest.advanceTimersByTime(INTERVAL * 3);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('reanuda el intervalo y llama inmediatamente al volver a visible', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL));
    expect(callback).toHaveBeenCalledTimes(1);

    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(INTERVAL);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('no inicia el intervalo si enabled es false', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL, false));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(INTERVAL * 2);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  test('no llama inmediatamente si immediate es false, pero sí al volver visible', () => {
    setHidden(false);
    const callback = jest.fn();

    renderHook(() => useVisibilityPolling(callback, INTERVAL, true, false));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(INTERVAL);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('ejecuta onResume antes del callback al volver a visible', () => {
    setHidden(false);
    const calls: string[] = [];
    const callback = jest.fn(() => calls.push('callback'));
    const onResume = jest.fn(() => calls.push('onResume'));

    renderHook(() =>
      useVisibilityPolling(callback, INTERVAL, true, false, onResume)
    );

    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    setHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(calls).toEqual(['onResume', 'callback']);
  });

  test('no ejecuta onResume cuando la pestaña se oculta', () => {
    setHidden(false);
    const callback = jest.fn();
    const onResume = jest.fn();

    renderHook(() =>
      useVisibilityPolling(callback, INTERVAL, true, false, onResume)
    );

    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onResume).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});
