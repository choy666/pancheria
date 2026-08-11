/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { ClosureHistory } from './closure-history';

const originalFetch = global.fetch;

function createPaginatedResponse<T>(items: T[], total = items.length) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total, page: 1, limit: 10 }),
  } as Response;
}

describe('ClosureHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  test('muestra un skeleton mientras carga', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    render(<ClosureHistory />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  test('muestra error cuando la API falla', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Error al cargar cierres' }),
    } as Response);

    render(<ClosureHistory />);

    await waitFor(() =>
      expect(screen.getByText('Error al cargar cierres')).toBeInTheDocument()
    );
  });

  test('muestra el historial de cierres', async () => {
    const closures = [
      {
        id: 1,
        date: '2025-06-15T00:00:00.000Z',
        total: 1500,
        cashTotal: 1000,
        transferTotal: 500,
        totalSales: 5,
        productsSummary: '{}',
        criticalSuppliesSummary: '{}',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createPaginatedResponse(closures, 1));

    render(<ClosureHistory />);

    await waitFor(() =>
      expect(
        screen.getByText((_, node) => node?.textContent === '$1500.00')
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText((_, node) => node?.textContent === '$1000.00')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === '$500.00')
    ).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('consulta el historial con un rango de fechas y paginación por defecto', async () => {
    global.fetch = jest.fn().mockResolvedValue(createPaginatedResponse([]));

    render(<ClosureHistory />);

    await act(async () => {});

    const url = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0] as string,
      'http://localhost'
    );
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('10');

    const diffTime = new Date(end as string).getTime() - new Date(start as string).getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });
});
