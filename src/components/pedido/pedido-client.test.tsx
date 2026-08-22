/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { PedidoClient } from './pedido-client';
import { useRouter } from 'next/navigation';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { Branch } from '@/domain/types';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/config/catalog', () => ({
  getWhatsAppNumber: jest.fn().mockReturnValue('5493415555555'),
  getWhatsAppMessageParts: jest.fn().mockReturnValue({
    greeting: 'Hola',
    closing: 'Gracias',
  }),
  getPedidoRefetchIntervalMs: jest.fn().mockReturnValue(1_000_000),
}));

const mockedUseRouter = useRouter as jest.Mock;

const STORAGE_KEY = 'pancheria-cart-v1';
const BRANCH_KEY = 'pancheria-branch-id';

const ORDER_ID = 42;
const CANCELLATION_TOKEN = 'cancel-token';
const WHATSAPP_URL = 'https://wa.me/5493415555555?text=pedido';

interface CreatedOrder {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  branchName: string | null;
  items: { productId: number; name: string; price: number; unit: string; quantity: number }[];
  createdAt: string;
  expiresAt: string;
  whatsappUrl: string | null;
}

function makeCreatedOrder(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: ORDER_ID,
    orderNumber: 'PED-1-1234567890-abc',
    status: 'pending',
    total: 1200,
    customerName: 'Juan Pérez',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: CANCELLATION_TOKEN,
    branchName: 'Sucursal A',
    items: [{ productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 }],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    whatsappUrl: WHATSAPP_URL,
    ...overrides,
  };
}

function makeBranch(id: number, name: string): Branch {
  return { id, name, createdAt: new Date() };
}

function makeProduct(overrides: Partial<PublicCatalogProduct> = {}): PublicCatalogProduct {
  return {
    id: 1,
    name: 'Panchuque',
    description: null,
    type: 'compound',
    criticalSupplyType: null,
    price: 1200,
    unit: 'unidad',
    availability: 5,
    breakdown: [],
    ...overrides,
  };
}

function createFetchResponse<T>(
  body: T,
  ok = true,
  status = ok ? 200 : 500
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('PedidoClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedUseRouter.mockReturnValue({ push: jest.fn() });
    global.fetch = jest.fn().mockImplementation(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/public/pedido/') && urlString.includes('/estado')) {
        return createFetchResponse({
          status: 'pending',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          isExpired: false,
        });
      }
      return createFetchResponse({
        branch: makeBranch(1, 'Sucursal A'),
        products: [],
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  test('muestra un selector claro cuando hay más de una sucursal', async () => {
    const branches = [makeBranch(1, 'Sucursal A'), makeBranch(2, 'Sucursal B')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[makeProduct()]}
        />
      );
      await Promise.resolve();
    });

    expect(
      screen.getByRole('heading', { name: 'Catálogo de Sucursal A' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('branch-select-label')).toHaveTextContent(
      'Sucursal'
    );
    expect(screen.getByTestId('branch-select-trigger')).toHaveTextContent(
      'Sucursal A'
    );
    expect(screen.queryByTestId('single-branch-indicator')).not.toBeInTheDocument();
  });

  test('muestra el nombre de la sucursal de forma prominente cuando hay una sola', async () => {
    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[makeProduct()]}
        />
      );
      await Promise.resolve();
    });

    const indicator = screen.getByTestId('single-branch-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Sucursal');
    expect(indicator).toHaveTextContent('Sucursal A');
    expect(screen.queryByTestId('branch-select-trigger')).not.toBeInTheDocument();
  });

  test('muestra el estado de error si la sucursal activa no está en el listado', async () => {
    const branches = [makeBranch(2, 'Sucursal B')];
    const activeBranch = makeBranch(1, 'Sucursal A');

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={activeBranch}
          initialProducts={[makeProduct()]}
        />
      );
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        'No pudimos cargar la sucursal activa. Estamos trabajando para solucionarlo. Volvé a intentar más tarde.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('branch-select-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('single-branch-indicator')).not.toBeInTheDocument();
  });

  test('guarda la sucursal activa en localStorage al montar', async () => {
    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[makeProduct()]}
        />
      );
      await Promise.resolve();
    });

    expect(localStorage.getItem(BRANCH_KEY)).toBe('1');
  });

  test('descarta el carrito guardado si pertenece a otra sucursal', async () => {
    const stored = {
      version: 'pancheria-cart-v1' as const,
      branchId: 99,
      items: [{ ...makeProduct({ id: 2, name: 'Otro' }), quantity: 2 }],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[makeProduct()]}
        />
      );
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    );
    expect(screen.queryByTestId('cart-item-2')).not.toBeInTheDocument();
  });

  test('limpia el carrito, actualiza localStorage y navega al cambiar de sucursal', async () => {
    const push = jest.fn();
    mockedUseRouter.mockReturnValue({ push });

    const branches = [
      makeBranch(1, 'Sucursal A'),
      makeBranch(2, 'Sucursal B'),
    ];
    const product = makeProduct({ id: 10, availability: 100 });

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[product]}
        />
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-product-10'));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId('cart-item-10')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('branch-select-trigger'));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByText('Sucursal B')).toBeInTheDocument()
    );

    const option = screen.getByText('Sucursal B');

    await act(async () => {
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/pedido?branchId=2');
    });
    expect(localStorage.getItem(BRANCH_KEY)).toBe('2');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('flujo de checkout', () => {
    const originalOpen = window.open;

    function setupFetchMocks(overrides: {
      createBody?: { order: CreatedOrder; whatsappUrl: string | null };
    } = {}) {
      global.fetch = jest.fn().mockImplementation(async (url, init) => {
        const urlString = String(url);
        if (urlString.includes('/api/public/disponibilidad')) {
          return createFetchResponse({
            availabilityByProduct: { 1: 5 },
            shortageByProduct: {},
            breakdownByProduct: {},
          });
        }

        if (urlString.includes('/api/public/pedido/') && urlString.includes('/estado')) {
          return createFetchResponse({
            status: 'pending',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            isExpired: false,
          });
        }

        if (urlString.includes('/api/public/pedido') && init?.method === 'POST') {
          return createFetchResponse(
            overrides.createBody ?? {
              order: makeCreatedOrder(),
              whatsappUrl: WHATSAPP_URL,
            },
            true,
            201
          );
        }

        return createFetchResponse({
          branch: makeBranch(1, 'Sucursal A'),
          products: [makeProduct()],
        });
      });
    }

    beforeEach(() => {
      window.open = jest.fn().mockReturnValue({});
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    async function completeCheckout() {
      const branches = [makeBranch(1, 'Sucursal A')];

      await act(async () => {
        render(
          <PedidoClient
            branches={branches}
            activeBranch={branches[0]}
            initialProducts={[makeProduct()]}
          />
        );
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-product-1'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('checkout-button'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByText('Finalizar pedido')).toBeInTheDocument()
      );

      const nameInput = screen.getByPlaceholderText('Tu nombre');
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Juan Pérez' } });
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Confirmar pedido'));
        await Promise.resolve();
      });
    }

    test('abre WhatsApp al crear el pedido', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByText('WhatsApp'));
        await Promise.resolve();
      });

      expect(window.open).toHaveBeenCalledWith(
        WHATSAPP_URL,
        '_blank',
        'noopener,noreferrer'
      );
    });

    test('muestra el resumen del pedido y el ícono de WhatsApp en el diálogo de pedido creado', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      const summary = screen.getByTestId('order-summary');
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent('Cliente: Juan Pérez');
      expect(summary).toHaveTextContent('Sucursal: Sucursal A');
      expect(summary).toHaveTextContent('Total: $1200.00');
      expect(summary).toHaveTextContent('1x Panchuque (unidad)');
      expect(summary).toHaveTextContent('$1200.00 c/u');

      const chatButton = screen.getByText('Ir al chat del pedido');
      expect(chatButton).toBeInTheDocument();
      expect(screen.getAllByTestId('whatsapp-icon').length).toBeGreaterThan(0);

      const whatsappButton = screen.getByText('WhatsApp');
      await act(async () => {
        fireEvent.click(whatsappButton);
        await Promise.resolve();
      });

      expect(window.open).toHaveBeenCalledWith(
        WHATSAPP_URL,
        '_blank',
        'noopener,noreferrer'
      );
    });

    test('muestra el enlace manual para abrir WhatsApp', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      const manualLink = screen.getByText('Abrir WhatsApp');
      expect(manualLink).toBeInTheDocument();
      expect(manualLink).toHaveAttribute('href', WHATSAPP_URL);
    });

    test('permite cerrar el diálogo de pedido creado', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Cerrar'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.queryByText('Pedido creado')).not.toBeInTheDocument()
      );
    });

    test('guarda el pedido en localStorage al crearlo y muestra el banner al cerrar el diálogo', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Cerrar'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.queryByText('Pedido creado')).not.toBeInTheDocument()
      );

      const banner = screen.getByTestId('recent-orders-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('PED-1-1234567890-abc');
      expect(banner).toHaveTextContent('Ir al chat');

      const stored = localStorage.getItem('pancheria-recent-orders-v1');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored as string);
      expect(parsed.orders[0].id).toBe(ORDER_ID);
      expect(parsed.orders[0].cancellationToken).toBe(CANCELLATION_TOKEN);
    });

    test('muestra el banner de pedidos recientes guardados previamente', async () => {
      const stored = {
        version: 'pancheria-recent-orders-v1',
        orders: [
          {
            id: ORDER_ID,
            orderNumber: 'PED-1-1234567890-abc',
            cancellationToken: CANCELLATION_TOKEN,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            branchId: 1,
            branchName: 'Sucursal A',
          },
        ],
      };
      localStorage.setItem('pancheria-recent-orders-v1', JSON.stringify(stored));

      const branches = [makeBranch(1, 'Sucursal A')];

      await act(async () => {
        render(
          <PedidoClient
            branches={branches}
            activeBranch={branches[0]}
            initialProducts={[makeProduct()]}
          />
        );
        await Promise.resolve();
      });

      const banner = screen.getByTestId('recent-orders-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('PED-1-1234567890-abc');
    });
  });
});
