/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ClosurePanel } from './closure-panel';
import { authenticatedFetch } from '@/lib/fetch';

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('date-fns', () => ({
  format: jest.fn(() => '2026-08-10'),
}));

const mockedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
>;

const mockClosure = {
  id: 1,
  date: '2026-08-10T00:00:00.000Z',
  total: 1500,
  cashTotal: 1500,
  transferTotal: 0,
  totalSales: 1,
  productsSummary: '{"Pancho":1}',
  criticalSuppliesSummary: '{}',
};

function createResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function createErrorResponse(message: string): Response {
  return {
    ok: false,
    json: jest.fn().mockResolvedValue({ error: message }),
  } as unknown as Response;
}

describe('ClosurePanel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('no muestra un cierre diario preexistente al cargar', async () => {
    mockedFetch.mockResolvedValue(createResponse(mockClosure));

    render(<ClosurePanel />);

    await waitFor(() => {
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    expect(
      screen.getByText('No hay cierre generado para la fecha seleccionada.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Total:')).not.toBeInTheDocument();
  });

  test('genera y muestra el cierre diario tras confirmar la fecha', async () => {
    mockedFetch.mockResolvedValue(createResponse(mockClosure));

    render(<ClosurePanel />);

    const button = screen.getByRole('button', { name: 'Generar cierre' });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('Total: $1500.00')).toBeInTheDocument();
    });

    expect(screen.getByText('Pancho')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/cierre',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-08-10' }),
      })
    );
  });

  test('muestra el error si la generación del cierre falla', async () => {
    mockedFetch.mockResolvedValue(
      createErrorResponse('Ya existe un cierre para la fecha seleccionada.')
    );

    render(<ClosurePanel />);

    const button = screen.getByRole('button', { name: 'Generar cierre' });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Ya existe un cierre para la fecha seleccionada.')
      ).toBeInTheDocument();
    });
  });

  test('limpia el cierre mostrado al cambiar la fecha', async () => {
    mockedFetch
      .mockResolvedValueOnce(createResponse(mockClosure))
      .mockResolvedValueOnce(createResponse({ ...mockClosure, id: 2 }));

    render(<ClosurePanel />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generar cierre' }));
    });

    await waitFor(() => {
      expect(screen.getByText('Total: $1500.00')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText('Fecha');
    fireEvent.change(dateInput, { target: { value: '2026-08-11' } });

    await waitFor(() => {
      expect(screen.queryByText('Total: $1500.00')).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('No hay cierre generado para la fecha seleccionada.')
    ).toBeInTheDocument();
  });
});
