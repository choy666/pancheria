/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SalesTerminal } from './sales-terminal';
import * as useCashRegisterModule from '@/hooks/useCashRegister';

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id'),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/hooks/useCashRegister');

jest.mock('@/components/caja/caja-status', () => ({
  CajaStatus: () => <div data-testid="caja-status" />,
}));

const mockedUseCashRegister =
  useCashRegisterModule.useCashRegister as jest.MockedFunction<
    typeof useCashRegisterModule.useCashRegister
  >;

const originalFetch = global.fetch;

function createFetchResponse<T>(body: T, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function mockCashRegister(open: boolean) {
  mockedUseCashRegister.mockReturnValue({
    cashRegister: open
      ? {
          id: 1,
          openedAt: new Date().toISOString(),
          closedAt: null,
          openedBy: 'admin',
          closedBy: null,
          status: 'open' as const,
          autoClosed: false,
          total: 0,
          cashTotal: 0,
          transferTotal: 0,
          totalSales: 0,
          productsSummary: {},
          criticalSuppliesSummary: {},
          createdAt: new Date().toISOString(),
        }
      : null,
    loading: false,
    error: null,
    lastUpdated: null,
    open: jest.fn(),
    close: jest.fn(),
    refresh: jest.fn(),
  });
}

describe('SalesTerminal', () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  test('muestra solo productos activos de tipos vendibles', async () => {
    mockCashRegister(true);

    const products = [
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
        unit: 'unidad',
        availability: 5,
      },
      {
        id: 2,
        name: 'Vaso de gaseosa',
        type: 'service',
        criticalSupplyType: null,
        price: 500,
        unit: 'unidad',
        availability: Number.MAX_SAFE_INTEGER,
      },
      {
        id: 3,
        name: 'Pritty',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 800,
        unit: 'lata',
        availability: 3,
      },
      {
        id: 4,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        price: 100,
        unit: 'unidad',
        availability: 10,
      },
      {
        id: 5,
        name: 'Ketchup',
        type: 'manual_supply',
        criticalSupplyType: null,
        price: 0,
        unit: 'unidad',
        availability: 100,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(products));

    render(<SalesTerminal />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/productos?includeAvailability=true',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    await waitFor(() =>
      expect(screen.getByText('Panchuque')).toBeInTheDocument()
    );
    expect(screen.getByText('Vaso de gaseosa')).toBeInTheDocument();
    expect(screen.getByText('Pritty')).toBeInTheDocument();
    expect(screen.queryByText('Pan')).not.toBeInTheDocument();
    expect(screen.queryByText('Ketchup')).not.toBeInTheDocument();
  });

  test('permite agregar productos con disponibilidad solo si hay caja abierta', async () => {
    mockCashRegister(true);

    const products = [
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
        unit: 'unidad',
        availability: 1,
      },
      {
        id: 2,
        name: 'Pritty',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 800,
        unit: 'lata',
        availability: 0,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(products));

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Panchuque')).toBeInTheDocument()
    );

    const panchuqueCard = screen.getByText('Panchuque').closest('[data-slot="card"]');
    const prittyCard = screen.getByText('Pritty').closest('[data-slot="card"]');

    expect(panchuqueCard).not.toHaveClass('opacity-50');
    expect(prittyCard).toHaveClass('opacity-50');

    fireEvent.click(panchuqueCard!);
    await waitFor(() => {
      expect(screen.getAllByText('Panchuque')).toHaveLength(2);
      expect(screen.queryByText('El carrito está vacío.')).not.toBeInTheDocument();
    });

    fireEvent.click(prittyCard!);
    expect(screen.getAllByText('Pritty')).toHaveLength(1);
    expect(screen.getAllByText('Panchuque')).toHaveLength(2);
    expect(screen.queryByText('El carrito está vacío.')).not.toBeInTheDocument();
  });

  test('no permite agregar productos si la caja está cerrada', async () => {
    mockCashRegister(false);

    const products = [
      {
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
        unit: 'unidad',
        availability: 5,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValue(createFetchResponse(products));

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Panchuque')).toBeInTheDocument()
    );

    const card = screen.getByText('Panchuque').closest('[data-slot="card"]');
    expect(card).toHaveClass('opacity-50');

    fireEvent.click(card!);
    expect(screen.queryByText('1 unidad')).not.toBeInTheDocument();
  });
});
