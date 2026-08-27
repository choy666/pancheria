/**
 * @jest-environment jsdom
 */
/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaginatedData } from './use-paginated-data';
import type { PaginatedResult } from '@/domain/types';

type TestLoad = (page: number, limit: number, signal: AbortSignal) => Promise<PaginatedResult<string>>;

describe('usePaginatedData', () => {
  test('inicia en estado de carga con los valores por defecto', async () => {
    const load = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
  });

  test('carga y expone los datos recibidos', async () => {
    const load = jest.fn().mockResolvedValue({
      items: ['a', 'b'],
      total: 2,
      page: 1,
      limit: 10,
    });

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    await act(async () => {});

    expect(result.current.items).toEqual(['a', 'b']);
    expect(result.current.total).toBe(2);
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledWith(1, 10, expect.any(AbortSignal));
  });

  test('expone el error cuando la carga falla', async () => {
    const load = jest.fn().mockRejectedValue(new Error('Fallo de red'));

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    await act(async () => {});

    expect(result.current.error).toBe('Fallo de red');
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('cambia de página al invocar setPage', async () => {
    const load = jest.fn().mockImplementation(async (page, limit) => ({
      items: [],
      total: 0,
      page,
      limit,
    }));

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setPage(3);
    });

    await act(async () => {});

    expect(result.current.page).toBe(3);
    expect(load).toHaveBeenCalledWith(3, 10, expect.any(AbortSignal));
  });

  test('reinicia a la página 1 al cambiar el tamaño de página', async () => {
    const load = jest.fn().mockImplementation(async (page, limit) => ({
      items: ['a'],
      total: 1,
      page,
      limit,
    }));

    const { result } = renderHook(() =>
      usePaginatedData(load as unknown as TestLoad, { initialPage: 3 })
    );

    await act(async () => {});
    expect(result.current.page).toBe(3);

    act(() => {
      result.current.setLimit(25);
    });

    await act(async () => {});

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(25);
    expect(load).toHaveBeenLastCalledWith(1, 25, expect.any(AbortSignal));
  });

  test('vuelve a la última página válida si la página solicitada está vacía', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        total: 5,
        page: 2,
        limit: 10,
      })
      .mockResolvedValueOnce({
        items: ['a', 'b', 'c', 'd', 'e'],
        total: 5,
        page: 1,
        limit: 10,
      });

    const { result } = renderHook(() =>
      usePaginatedData(load as unknown as TestLoad, { initialPage: 2, initialLimit: 10 })
    );

    await act(async () => {});

    expect(result.current.page).toBe(1);
    expect(result.current.items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.current.total).toBe(5);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('recarga los datos al invocar refresh', async () => {
    const load = jest.fn().mockResolvedValue({
      items: ['a'],
      total: 1,
      page: 1,
      limit: 10,
    });

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await act(async () => {});

    expect(load).toHaveBeenCalledTimes(2);
  });

  test('recarga los datos en segundo plano sin reiniciar isLoading', async () => {
    const load = jest.fn().mockResolvedValue({
      items: ['a'],
      total: 1,
      page: 1,
      limit: 10,
    });

    const { result } = renderHook(() => usePaginatedData(load as unknown as TestLoad));

    await act(async () => {});

    act(() => {
      result.current.refresh();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {});

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('refresca automáticamente según refreshIntervalMs', async () => {
    jest.useFakeTimers();
    const load = jest.fn().mockResolvedValue({
      items: ['a'],
      total: 1,
      page: 1,
      limit: 10,
    });

    const { result } = renderHook(() =>
      usePaginatedData(load as unknown as TestLoad, { refreshIntervalMs: 1_000 })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    jest.useRealTimers();
  });
});
