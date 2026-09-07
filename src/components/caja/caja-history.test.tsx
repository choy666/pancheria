/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CajaHistory } from './caja-history';
import * as useCashRegisterHistoryModule from './use-cash-register-history';
import { authenticatedFetch } from '@/lib/fetch';
import { CAJA_ELIMINADAS_API, CAJA_HISTORIAL_API } from '@/config/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: jest.fn(),
  throwApiError: jest.fn(),
}));

jest.mock('./use-cash-register-history');

const mockedUseCashRegisterHistory =
  useCashRegisterHistoryModule.useCashRegisterHistory as jest.MockedFunction<
    typeof useCashRegisterHistoryModule.useCashRegisterHistory
  >;

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
>;

function createMockReturn(
  overrides: Partial<useCashRegisterHistoryModule.UseCashRegisterHistoryReturn> = {}
): useCashRegisterHistoryModule.UseCashRegisterHistoryReturn {
  return {
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-01-31T23:59:59.999Z',
    error: null,
    isLoading: false,
    setPage: jest.fn(),
    setLimit: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

describe('CajaHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('muestra un mensaje de carga inicial', () => {
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({ isLoading: true })
    );

    render(<CajaHistory />);

    expect(screen.getByText('Cargando historial...')).toBeInTheDocument();
  });

  test('muestra el error proveniente del hook', () => {
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({ error: 'Error al listar cajas' })
    );

    render(<CajaHistory />);

    expect(screen.getByText('Error al listar cajas')).toBeInTheDocument();
  });

  test('renderiza la tabla cuando hay datos', () => {
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({
        data: [
          {
            id: 1,
            branchId: 1,
            openedAt: '2025-01-15T10:00:00.000Z',
            closedAt: '2025-01-15T22:00:00.000Z',
            openedBy: 'admin',
            closedBy: 'admin',
            status: 'closed',
            autoClosed: false,
            initialAmount: 0,
            total: 1500,
            cashTotal: 1000,
            transferTotal: 500,
            totalSales: 3,
            deletedAt: null,
            createdAt: '2025-01-15T10:00:00.000Z',
          },
        ],
        total: 1,
      })
    );

    render(<CajaHistory />);

    expect(screen.getByTestId('cash-register-id-1')).toHaveTextContent('#1');
    expect(screen.getByTestId('cash-register-total-1')).toHaveTextContent(
      '$ 1.500'
    );
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
  });

  test('muestra las diferencias de efectivo y transferencia al cerrar', () => {
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({
        data: [
          {
            id: 1,
            branchId: 1,
            openedAt: '2025-01-15T10:00:00.000Z',
            closedAt: '2025-01-15T22:00:00.000Z',
            openedBy: 'admin',
            closedBy: 'admin',
            status: 'closed',
            autoClosed: false,
            initialAmount: 0,
            total: 1500,
            cashTotal: 1000,
            transferTotal: 500,
            totalSales: 3,
            closingCashCount: 1050,
            closingDifference: 50,
            closingTransferCount: 450,
            closingTransferDifference: -50,
            deletedAt: null,
            createdAt: '2025-01-15T10:00:00.000Z',
          },
        ],
        total: 1,
      })
    );

    render(<CajaHistory />);

    expect(
      screen.getByTestId('cash-register-cash-difference-1')
    ).toHaveTextContent('Efectivo: +$ 50');
    expect(
      screen.getByTestId('cash-register-transfer-difference-1')
    ).toHaveTextContent('Transferencia: -$ 50');
  });

  test('muestra el botón de eliminar cajas cerradas solo a admin', () => {
    mockedUseCashRegisterHistory.mockReturnValue(createMockReturn());

    const { unmount } = render(<CajaHistory isAdmin />);
    expect(screen.getByTestId('delete-all-closed')).toBeInTheDocument();
    unmount();

    render(<CajaHistory />);
    expect(screen.queryByTestId('delete-all-closed')).not.toBeInTheDocument();
  });

  test('en la papelera muestra Vaciar papelera en lugar del botón de cerradas', () => {
    mockedUseCashRegisterHistory.mockReturnValue(createMockReturn());

    render(<CajaHistory deletedOnly isAdmin />);

    expect(screen.getByTestId('empty-trash')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-all-closed')).not.toBeInTheDocument();
  });

  test('envía todas las cajas cerradas a la papelera tras confirmar', async () => {
    const refresh = jest.fn();
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({ refresh })
    );
    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: 3 }),
    } as unknown as Response);

    render(<CajaHistory isAdmin />);
    fireEvent.click(screen.getByTestId('delete-all-closed'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() =>
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        CAJA_HISTORIAL_API,
        { method: 'DELETE' }
      )
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByTestId('bulk-action-result')).toHaveTextContent(
      '3 cajas a la papelera'
    );
  });

  test('vacia la papelera sin enviar rango de fechas', async () => {
    const refresh = jest.fn();
    mockedUseCashRegisterHistory.mockReturnValue(
      createMockReturn({ refresh })
    );
    mockedAuthenticatedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: 2 }),
    } as unknown as Response);

    render(<CajaHistory deletedOnly isAdmin />);
    fireEvent.click(screen.getByTestId('empty-trash'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() =>
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        CAJA_ELIMINADAS_API,
        { method: 'DELETE' }
      )
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByTestId('bulk-action-result')).toHaveTextContent(
      'Se eliminaron definitivamente 2 cajas'
    );
  });
});
