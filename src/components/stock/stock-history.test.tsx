/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { StockHistory } from './stock-history';

const originalFetch = global.fetch;

function createFetchResponse<T>(body: T, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function createPaginatedResponse<T>(items: T[], total = items.length) {
  return createFetchResponse({ items, total, page: 1, limit: 10 });
}

describe('StockHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  test('muestra skeleton mientras carga', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    render(<StockHistory productId={1} productName="Pan" />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  test('muestra error cuando la API falla', async () => {
    global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ error: 'Error del servidor' }, false, 500));

    render(<StockHistory productId={1} productName="Pan" />);

    await waitFor(() => expect(screen.getByText('Error del servidor')).toBeInTheDocument());
  });

  test('muestra error desconocido cuando fetch rechaza con un valor no Error', async () => {
    global.fetch = jest.fn().mockRejectedValue('Error de red');

    render(<StockHistory productId={1} productName="Pan" />);

    await waitFor(() => expect(screen.getByText('Error desconocido')).toBeInTheDocument());
  });

  test('muestra el historial de movimientos', async () => {
    const movements = [
      {
        id: 1,
        type: 'manual_adjustment',
        quantity: 5,
        reason: 'Ajuste de prueba',
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 2,
        type: 'sale',
        quantity: -2,
        reason: null,
        createdAt: '2025-01-15T11:00:00.000Z',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createPaginatedResponse(movements, 2));

    render(<StockHistory productId={1} productName="Pan" />);

    await waitFor(() =>
      expect(
        screen.getByText((_, node) => node?.textContent === 'Historial de movimientos para Pan')
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Ajuste manual')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });
});
