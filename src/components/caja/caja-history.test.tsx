/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { CajaHistory } from './caja-history';
import * as useCashRegisterHistoryModule from './use-cash-register-history';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('./use-cash-register-history');

const mockedUseCashRegisterHistory =
  useCashRegisterHistoryModule.useCashRegisterHistory as jest.MockedFunction<
    typeof useCashRegisterHistoryModule.useCashRegisterHistory
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
});
