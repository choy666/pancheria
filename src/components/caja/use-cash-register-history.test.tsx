/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCashRegisterHistory } from './use-cash-register-history';

const originalFetch = global.fetch;

describe('useCashRegisterHistory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  function mockFetch(response: Partial<Response>) {
    global.fetch = jest.fn().mockResolvedValue(response as Response);
  }

  function createPaginatedResponse<T>(items: T[], total = items.length) {
    return {
      ok: true,
      json: async () => ({ items, total, page: 1, limit: 10 }),
    } as Response;
  }

  test('inicia en estado de carga', async () => {
    mockFetch(createPaginatedResponse([]));

    const { result } = renderHook(() => useCashRegisterHistory());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  test('devuelve datos cuando la API responde correctamente', async () => {
    const payload = [
      {
        id: 1,
        openedAt: '2025-01-15T10:00:00.000Z',
        closedAt: '2025-01-15T22:00:00.000Z',
        openedBy: 'admin',
        closedBy: 'admin',
        status: 'closed',
        autoClosed: false,
        total: 1500,
        cashTotal: 1000,
        transferTotal: 500,
        totalSales: 3,
        deletedAt: null,
        createdAt: '2025-01-15T10:00:00.000Z',
      },
    ];
    mockFetch(createPaginatedResponse(payload, 1));

    const { result } = renderHook(() => useCashRegisterHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(payload);
    expect(result.current.total).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
    expect(result.current.startDate).toBeDefined();
    expect(result.current.endDate).toBeDefined();
  });

  test('expone el error cuando la API devuelve un error de servidor (500)', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Error al listar cajas' }),
    } as Response);

    const { result } = renderHook(() => useCashRegisterHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Error al listar cajas');
  });

  test('expone un mensaje de error cuando fetch falla por un problema de red', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCashRegisterHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  test('refresca los datos al invocar refresh', async () => {
    mockFetch(createPaginatedResponse([]));

    const { result } = renderHook(() => useCashRegisterHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test('incluye el filtro de estado en la URL cuando no es "all"', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createPaginatedResponse([]) as unknown as Response);

    renderHook(() => useCashRegisterHistory({ statusFilter: 'closed' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const url = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0] as string,
      'http://localhost'
    );
    expect(url.searchParams.get('status')).toBe('closed');
  });

  test('cambia de página al invocar setPage', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(createPaginatedResponse([]) as unknown as Response);

    const { result } = renderHook(() => useCashRegisterHistory());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastUrl = new URL(
        calls[calls.length - 1][0] as string,
        'http://localhost'
      );
      return expect(lastUrl.searchParams.get('page')).toBe('2');
    });
  });
});
