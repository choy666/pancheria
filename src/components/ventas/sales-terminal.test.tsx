/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SalesTerminal } from './sales-terminal';
import * as useCashRegisterModule from '@/hooks/useCashRegister';
import {
  PRODUCTOS_API,
  VENTAS_DISPONIBILIDAD_API,
} from '@/config/api';
import { ProductType, CriticalSupplyType } from '@/domain/types';

type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  availability: number;
};

type Shortage = {
  available: number;
  required: number;
  supplyName: string;
};

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

function mockFetch(
  products: Product[],
  availability: Record<number, number> = {},
  shortage: Record<number, Shortage> = {}
) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url === `${PRODUCTOS_API}?includeAvailability=true`) {
      return createFetchResponse(products);
    }
    if (url === VENTAS_DISPONIBILIDAD_API) {
      return createFetchResponse({
        availabilityByProduct: availability,
        shortageByProduct: shortage,
      });
    }
    return createFetchResponse(null, false, 404);
  });
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

  test('ordena los productos vendibles: compound, bebida y servicio', async () => {
    mockCashRegister(true);

    const products: Product[] = [
      {
        id: 3,
        name: 'Z servicio',
        type: 'service',
        criticalSupplyType: null,
        price: 500,
        unit: 'unidad',
        availability: Number.MAX_SAFE_INTEGER,
      },
      {
        id: 2,
        name: 'A bebida',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 800,
        unit: 'lata',
        availability: 3,
      },
      {
        id: 1,
        name: 'Z promo',
        type: 'compound',
        criticalSupplyType: null,
        price: 1500,
        unit: 'unidad',
        availability: 5,
      },
    ];

    mockFetch(products, {
      1: 5,
      2: 3,
      3: Number.MAX_SAFE_INTEGER,
    });

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Z promo')).toBeInTheDocument()
    );

    const cards = document.querySelectorAll('[data-slot="card"]');
    const productNames = Array.from(cards)
      .map((card) =>
        card.querySelector('[data-slot="card-title"]')?.textContent
      )
      .filter((name): name is string => !!name && name !== 'Pedido');

    expect(productNames).toEqual(['Z promo', 'A bebida', 'Z servicio']);
  });

  test('muestra solo productos activos de tipos vendibles', async () => {
    mockCashRegister(true);

    const products: Product[] = [
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

    mockFetch(products, { 1: 5, 2: Number.MAX_SAFE_INTEGER, 3: 3 });

    render(<SalesTerminal />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/productos?includeAvailability=true',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        VENTAS_DISPONIBILIDAD_API,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
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

    const products: Product[] = [
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

    mockFetch(products, { 1: 1, 2: 0 });

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Panchuque')).toBeInTheDocument()
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        VENTAS_DISPONIBILIDAD_API,
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
    });

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

    const products: Product[] = [
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

    mockFetch(products, { 1: 5 });

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Panchuque')).toBeInTheDocument()
    );

    const card = screen.getByText('Panchuque').closest('[data-slot="card"]');
    expect(card).toHaveClass('opacity-50');

    fireEvent.click(card!);
    expect(screen.queryByText('1 unidad')).not.toBeInTheDocument();
  });

  test('un servicio se puede agregar aunque haya productos sin stock', async () => {
    mockCashRegister(true);

    const products: Product[] = [
      {
        id: 1,
        name: 'Bebida agotada',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 800,
        unit: 'lata',
        availability: 0,
      },
      {
        id: 2,
        name: 'Servicio libre',
        type: 'service',
        criticalSupplyType: null,
        price: 500,
        unit: 'unidad',
        availability: Number.MAX_SAFE_INTEGER,
      },
    ];

    mockFetch(products, { 1: 0, 2: Number.MAX_SAFE_INTEGER });

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Bebida agotada')).toBeInTheDocument()
    );

    const bebidaCard = screen.getByText('Bebida agotada').closest('[data-slot="card"]');
    const servicioCard = screen.getByText('Servicio libre').closest('[data-slot="card"]');

    expect(bebidaCard).toHaveClass('opacity-50');
    expect(servicioCard).not.toHaveClass('opacity-50');

    fireEvent.click(bebidaCard!);
    expect(screen.getAllByText('Bebida agotada')).toHaveLength(1);

    fireEvent.click(servicioCard!);
    fireEvent.click(servicioCard!);

    await waitFor(() => {
      expect(screen.getAllByText('Servicio libre')).toHaveLength(2);
    });
  });

  test('bloquea agregar un producto cuando otro consume el mismo insumo', async () => {
    mockCashRegister(true);

    const products: Product[] = [
      {
        id: 1,
        name: 'Promo A',
        type: 'compound',
        criticalSupplyType: null,
        price: 2000,
        unit: 'unidad',
        availability: 4,
      },
      {
        id: 2,
        name: 'Promo B',
        type: 'compound',
        criticalSupplyType: null,
        price: 2000,
        unit: 'unidad',
        availability: 4,
      },
    ];

    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === `${PRODUCTOS_API}?includeAvailability=true`) {
        return createFetchResponse(products);
      }
      if (url === VENTAS_DISPONIBILIDAD_API) {
        const body = JSON.parse(
          typeof init?.body === 'string' ? init.body : '{}'
        ) as {
          items: { productId: number; quantity: number }[];
        };
        const items = body.items;
        const consumed = items.reduce(
          (sum, item) => sum + item.quantity * 2,
          0
        );
        const remaining = 8 - consumed;
        const availability: Record<number, number> = {};
        for (const product of products) {
          availability[product.id] = Math.max(0, Math.floor(remaining / 2));
        }
        return createFetchResponse({
          availabilityByProduct: availability,
          shortageByProduct: {},
        });
      }
      return createFetchResponse(null, false, 404);
    });

    render(<SalesTerminal />);

    await waitFor(() =>
      expect(screen.getByText('Promo A')).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getAllByText(/4 más/)).toHaveLength(2)
    );

    const cardA = screen.getByText('Promo A').closest('[data-slot="card"]');
    const cardB = screen.getByText('Promo B').closest('[data-slot="card"]');

    fireEvent.click(cardA!);
    await waitFor(() =>
      expect(screen.getAllByText('Promo A')).toHaveLength(2)
    );

    fireEvent.click(cardA!);
    fireEvent.click(cardA!);
    fireEvent.click(cardA!);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        VENTAS_DISPONIBILIDAD_API,
        expect.objectContaining({
          body: JSON.stringify({
            items: [{ productId: 1, quantity: 4 }],
            productIds: [1, 2],
          }),
        })
      )
    );

    fireEvent.click(cardB!);
    expect(screen.getAllByText('Promo B')).toHaveLength(1);
  });
});
