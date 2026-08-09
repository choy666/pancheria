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

describe('CajaHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('muestra un mensaje de carga inicial', () => {
    mockedUseCashRegisterHistory.mockReturnValue({
      data: null,
      startDate: null,
      endDate: null,
      error: null,
      isLoading: true,
      refresh: jest.fn(),
    });

    render(<CajaHistory />);

    expect(screen.getByText('Cargando historial...')).toBeInTheDocument();
  });

  test('muestra el error proveniente del hook', () => {
    mockedUseCashRegisterHistory.mockReturnValue({
      data: null,
      startDate: null,
      endDate: null,
      error: 'Error al listar cajas',
      isLoading: false,
      refresh: jest.fn(),
    });

    render(<CajaHistory />);

    expect(screen.getByText('Error al listar cajas')).toBeInTheDocument();
  });

  test('muestra un mensaje de error inesperado cuando faltan datos', () => {
    mockedUseCashRegisterHistory.mockReturnValue({
      data: null,
      startDate: null,
      endDate: null,
      error: null,
      isLoading: false,
      refresh: jest.fn(),
    });

    render(<CajaHistory />);

    expect(
      screen.getByText('Error inesperado al cargar cajas')
    ).toBeInTheDocument();
  });

  test('renderiza la tabla cuando hay datos', () => {
    mockedUseCashRegisterHistory.mockReturnValue({
      data: [
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
      ],
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-01-31T23:59:59.999Z',
      error: null,
      isLoading: false,
      refresh: jest.fn(),
    });

    render(<CajaHistory />);

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('$1500.00')).toBeInTheDocument();
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
  });
});
