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
  getPedidoRefetchIntervalMs: jest.fn().mockReturnValue(1_000_000),
}));

const mockedUseRouter = useRouter as jest.Mock;

const STORAGE_KEY = 'pancheria-cart-v1';
const BRANCH_KEY = 'pancheria-branch-id';

const ORDER_ID = 42;
const CANCELLATION_TOKEN = 'cancel-token';

interface CreatedOrder {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  branchName: string | null;
  items: { productId: number; name: string; price: number; unit: string; quantity: number }[];
  createdAt: string;
  expiresAt: string;
}

function makeCreatedOrder(overrides: Partial<CreatedOrder> = {}): CreatedOrder {
  return {
    id: ORDER_ID,
    orderNumber: 'PED-1-1234567890-abc',
    status: 'pending',
    total: 1200,
    customerName: 'Juan Pérez',
    customerPhone: '3415555555',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: CANCELLATION_TOKEN,
    branchName: 'Sucursal A',
    items: [{ productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 }],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function makeBranch(
  id: number,
  name: string,
  overrides: Partial<Branch> = {}
): Branch {
  return {
    id,
    name,
    openingHours: [],
    phones: [],
    socialLinks: [],
    createdAt: new Date(),
    ...overrides,
  };
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
    expect(document.querySelector('[data-product-id="2"]')).not.toBeInTheDocument();
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
      expect(document.querySelector('[data-product-id="10"]')).toBeInTheDocument()
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

  test('carga la siguiente página con "Cargar más" y oculta el botón al llegar al total', async () => {
    const p1 = makeProduct({ id: 1, name: 'Panchuque' });
    const p2 = makeProduct({
      id: 2,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
    });

    global.fetch = jest.fn().mockImplementation(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/public/catalogo') && urlString.includes('offset=')) {
        return createFetchResponse({
          branch: makeBranch(1, 'Sucursal A'),
          products: [p2],
          total: 2,
        });
      }
      return createFetchResponse({
        branch: makeBranch(1, 'Sucursal A'),
        products: [p1],
        total: 2,
      });
    });

    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[p1]}
          initialTotal={2}
          pageSize={1}
        />
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId('product-card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('product-card-2')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('catalog-load-more'));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId('product-card-2')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('catalog-load-more')).not.toBeInTheDocument();
  });

  test('el refresco pide solo la primera página y disponibilidad de los ya cargados', async () => {
    const p1 = makeProduct({ id: 1, name: 'Panchuque' });
    const p2 = makeProduct({
      id: 2,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
    });
    const p1Updated = makeProduct({
      id: 1,
      name: 'Panchuque XL',
      availability: 7,
    });

    const fetchMock = jest.fn().mockImplementation(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/public/disponibilidad')) {
        return createFetchResponse({
          availabilityByProduct: { 2: 3 },
          shortageByProduct: {},
        });
      }
      if (urlString.includes('offset=')) {
        return createFetchResponse({
          branch: makeBranch(1, 'Sucursal A'),
          products: [p2],
          total: 2,
        });
      }
      return createFetchResponse({
        branch: makeBranch(1, 'Sucursal A'),
        products: [p1Updated],
        total: 2,
      });
    });
    global.fetch = fetchMock;

    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[p1]}
          initialTotal={2}
          pageSize={1}
        />
      );
      await Promise.resolve();
    });

    // "Cargar más" trae la segunda página (producto 2).
    await act(async () => {
      fireEvent.click(screen.getByTestId('catalog-load-more'));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId('product-card-2')).toBeInTheDocument()
    );

    fetchMock.mockClear();

    // El polling se dispara también cuando la pestaña vuelve a ser visible.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await waitFor(() => {
      const catalogCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/public/catalogo')
      );
      expect(catalogCalls).toHaveLength(1);
      // No re-descarga las páginas ya cargadas: solo la primera.
      expect(String(catalogCalls[0][0])).toContain('limit=1');
      expect(String(catalogCalls[0][0])).not.toContain('offset=');
    });

    // Pide disponibilidad liviana solo para los IDs de páginas posteriores.
    const availabilityCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/public/disponibilidad')
    );
    expect(availabilityCalls).toHaveLength(1);
    const availabilityInit = availabilityCalls[0][1] as RequestInit;
    expect(availabilityInit.method).toBe('POST');
    expect(JSON.parse(String(availabilityInit.body))).toEqual({
      items: [],
      productIds: [2],
    });

    // La primera página se reemplaza con datos frescos y el producto
    // extra cargado se conserva.
    await waitFor(() => {
      expect(screen.getByText('Panchuque XL')).toBeInTheDocument();
      expect(screen.getByTestId('product-card-2')).toBeInTheDocument();
    });
  });

  test('el refresco conserva la disponibilidad previa si falla la consulta liviana', async () => {
    const p1 = makeProduct({ id: 1, name: 'Panchuque' });
    const p2 = makeProduct({
      id: 2,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      availability: 9,
    });

    const fetchMock = jest.fn().mockImplementation(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/public/disponibilidad')) {
        return createFetchResponse({ error: 'boom' }, false, 500);
      }
      if (urlString.includes('offset=')) {
        return createFetchResponse({
          branch: makeBranch(1, 'Sucursal A'),
          products: [p2],
          total: 2,
        });
      }
      return createFetchResponse({
        branch: makeBranch(1, 'Sucursal A'),
        products: [p1],
        total: 2,
      });
    });
    global.fetch = fetchMock;

    const branches = [makeBranch(1, 'Sucursal A')];

    await act(async () => {
      render(
        <PedidoClient
          branches={branches}
          activeBranch={branches[0]}
          initialProducts={[p1]}
          initialTotal={2}
          pageSize={1}
        />
      );
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('catalog-load-more'));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId('product-card-2')).toBeInTheDocument()
    );

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Los productos cargados no desaparecen ante un error transitorio del
    // endpoint de disponibilidad.
    await waitFor(() => {
      expect(screen.getByTestId('product-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('product-card-2')).toBeInTheDocument();
    });
  });

  describe('flujo de checkout', () => {
    function setupFetchMocks(overrides: {
      createBody?: { order: CreatedOrder };
      branchStatus?: {
        isOpen?: boolean;
        currentOpening?: string;
        nextOpening?: string;
        message?: string;
        branch?: Branch;
      };
    } = {}) {
      global.fetch = jest.fn().mockImplementation(async (url, init) => {
        const urlString = String(url);
        if (urlString.includes('/api/public/disponibilidad')) {
          return createFetchResponse({
            availabilityByProduct: { 1: 5 },
            shortageByProduct: {},
          });
        }

        if (urlString.includes('/api/public/sucursal/estado')) {
          return createFetchResponse({
            isOpen: true,
            currentOpening: 'Hoy de 08:00 a 18:00',
            nextOpening: 'Mañana de 08:00 a 18:00',
            message: 'Sucursal abierta: Horario de hoy: Hoy de 08:00 a 18:00.',
            branch: makeBranch(1, 'Sucursal A'),
            ...overrides.branchStatus,
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
        expect(document.querySelector('[data-product-id="1"]')).toBeInTheDocument()
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

      const phoneInput = screen.getByPlaceholderText('Ej: 3415555555');
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '3415555555' } });
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Confirmar pedido'));
        await Promise.resolve();
      });
    }

    async function openCheckoutDialog(branchStatusOverrides: {
      isOpen?: boolean;
      currentOpening?: string;
      nextOpening?: string;
      message?: string;
      branch?: Branch;
    } = {}) {
      setupFetchMocks({ branchStatus: branchStatusOverrides });

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
        expect(document.querySelector('[data-product-id="1"]')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('checkout-button'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByText('Finalizar pedido')).toBeInTheDocument()
      );
    }

    test('muestra el resumen del pedido en el diálogo de pedido creado', async () => {
      setupFetchMocks();

      await completeCheckout();

      await waitFor(() =>
        expect(screen.getByText('Pedido creado')).toBeInTheDocument()
      );

      const summary = screen.getByTestId('order-summary');
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent('Cliente: Juan Pérez');
      expect(summary).toHaveTextContent('Sucursal: Sucursal A');
      expect(summary).toHaveTextContent('Total: $ 1.200');
      expect(summary).toHaveTextContent('1x Panchuque (unidad)');
      expect(summary).toHaveTextContent('$ 1.200 c/u');

      const chatButton = screen.getByText('Ir al chat del pedido');
      expect(chatButton).toBeInTheDocument();
    });

    test('muestra la información de la sucursal al abrir el checkout', async () => {
      await openCheckoutDialog();

      // El estado también se muestra en el encabezado del catálogo.
      expect(screen.getAllByText('Abierto ahora').length).toBeGreaterThan(0);
      expect(
        screen.getAllByText('Horario de hoy: Hoy de 08:00 a 18:00').length
      ).toBeGreaterThan(0);
      expect(
        screen.getByText('Sucursal abierta: Hoy de 08:00 a 18:00.')
      ).toBeInTheDocument();
    });

    test('muestra la advertencia cuando la sucursal está cerrada', async () => {
      await openCheckoutDialog({
        isOpen: false,
        currentOpening: 'Hoy de 09:00 a 14:00',
        nextOpening: 'Mañana de 09:00 a 14:00',
        message:
          'La sucursal está cerrada. Próxima apertura: Mañana de 09:00 a 14:00.',
      });

      expect(screen.getAllByText(/Cerrado/).length).toBeGreaterThan(0);
      expect(
        screen.getByText(/La sucursal está cerrada/)
      ).toBeInTheDocument();
    });

    test('muestra dirección, teléfonos y enlace al mapa cuando la sucursal los tiene', async () => {
      const branch = makeBranch(1, 'Sucursal A', {
        address: 'Av. Pellegrini 1234, Rosario',
        phones: [
          { label: 'Pedidos', number: '3415555555' },
          { label: 'WhatsApp', number: '3416666666' },
        ],
        location: 'https://maps.example.com/sucursal-a',
      });

      await openCheckoutDialog({
        branch,
      });

      // La tarjeta se muestra en el encabezado y en el checkout.
      expect(
        screen.getAllByText('Dirección: Av. Pellegrini 1234, Rosario').length
      ).toBeGreaterThan(0);
      expect(screen.getAllByTestId('branch-phone')[0]).toHaveTextContent(
        'Pedidos: 3415555555'
      );
      expect(
        screen.getAllByText('WhatsApp: 3416666666').length
      ).toBeGreaterThan(0);
      const mapLinks = screen.getAllByTestId('branch-map-link');
      expect(mapLinks.length).toBeGreaterThan(0);
      expect(mapLinks[0]).toHaveTextContent('Ver en mapa');
      expect(mapLinks[0]).toHaveAttribute(
        'href',
        'https://maps.example.com/sucursal-a'
      );
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

    test('muestra el resumen del pedido en el checkout', async () => {
      setupFetchMocks();

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
        expect(document.querySelector('[data-product-id="1"]')).toBeInTheDocument()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('checkout-button'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByText('Finalizar pedido')).toBeInTheDocument()
      );

      const summary = screen.getByTestId('checkout-summary');
      expect(summary).toHaveTextContent('Resumen del pedido');
      expect(summary).toHaveTextContent('Panchuque x 1');
      expect(summary).toHaveTextContent('Total: $ 1.200');
    });

    test('muestra el estado de la sucursal en el encabezado del catálogo', async () => {
      setupFetchMocks();

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
        expect(screen.getByTestId('branch-status-chip')).toHaveTextContent(
          'Abierto ahora'
        )
      );
    });

    test('muestra un mensaje de falta de disponibilidad sin datos internos', async () => {
      global.fetch = jest.fn().mockImplementation(async (url) => {
        const urlString = String(url);
        if (urlString.includes('/api/public/disponibilidad')) {
          // El API público solo expone qué productos faltan, sin datos internos.
          return createFetchResponse({
            availabilityByProduct: { 1: 0 },
            shortageByProduct: { 1: true },
          });
        }
        return createFetchResponse({
          branch: makeBranch(1, 'Sucursal A'),
          products: [makeProduct()],
        });
      });

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

      await waitFor(
        () =>
          expect(
            screen.getByText(/No hay suficiente Panchuque por el momento/)
          ).toBeInTheDocument(),
        { timeout: 3000 }
      );

      // No se exponen nombres de insumos ni cantidades internas.
      expect(screen.queryByText(/Pan interno/)).not.toBeInTheDocument();
      expect(screen.queryByText(/disponible 0/i)).not.toBeInTheDocument();
      expect(
        screen.getAllByTestId('cart-item-shortage')[0]
      ).toHaveTextContent(/no alcanza la disponibilidad/);
    });

    test('muestra un estado vacío amigable cuando la sucursal no tiene productos', async () => {
      const branches = [makeBranch(1, 'Sucursal A')];

      await act(async () => {
        render(
          <PedidoClient
            branches={branches}
            activeBranch={branches[0]}
            initialProducts={[]}
          />
        );
        await Promise.resolve();
      });

      expect(screen.getByTestId('catalog-empty-state')).toHaveTextContent(
        'No hay productos disponibles en esta sucursal por ahora'
      );
    });

    test('muestra el stepper y la barra de carrito mobile al agregar productos', async () => {
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

      expect(screen.getByTestId('pedido-steps')).toHaveTextContent(
        '1. Elegí tus productos'
      );
      expect(
        screen.queryByTestId('mobile-cart-bar')
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('add-product-1'));
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByTestId('mobile-cart-bar')).toBeInTheDocument()
      );
      expect(screen.getByTestId('mobile-cart-bar')).toHaveTextContent(
        'Ver mi pedido'
      );
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

    // QA-2026-09-21-02 (corregido): `handleSubmitCheckout` generaba
    // `nanoid()` en cada intento y el reintento eludía la deduplicación
    // del servidor. La clave se conserva mientras el carrito no cambie.
    test(
      'reusa la misma idempotencyKey al reintentar el submit tras un error',
      async () => {
        const submittedKeys: string[] = [];
        let postCount = 0;

        global.fetch = jest.fn().mockImplementation(async (url, init) => {
          const urlString = String(url);
          if (urlString.includes('/api/public/disponibilidad')) {
            return createFetchResponse({
              availabilityByProduct: { 1: 5 },
              shortageByProduct: {},
            });
          }
          if (urlString.includes('/api/public/sucursal/estado')) {
            return createFetchResponse({
              isOpen: true,
              branch: makeBranch(1, 'Sucursal A'),
            });
          }
          if (
            urlString.includes('/api/public/pedido') &&
            init?.method === 'POST'
          ) {
            postCount += 1;
            const body = JSON.parse(String(init.body)) as {
              idempotencyKey: string;
            };
            submittedKeys.push(body.idempotencyKey);
            if (postCount === 1) {
              return createFetchResponse(
                { error: 'Error de red simulado' },
                false,
                500
              );
            }
            return createFetchResponse(
              { order: makeCreatedOrder() },
              true,
              201
            );
          }
          return createFetchResponse({
            branch: makeBranch(1, 'Sucursal A'),
            products: [makeProduct()],
          });
        });

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
          expect(
            document.querySelector('[data-product-id="1"]')
          ).toBeInTheDocument()
        );

        await act(async () => {
          fireEvent.click(screen.getByTestId('checkout-button'));
          await Promise.resolve();
        });

        await waitFor(() =>
          expect(screen.getByText('Finalizar pedido')).toBeInTheDocument()
        );

        await act(async () => {
          fireEvent.change(screen.getByPlaceholderText('Tu nombre'), {
            target: { value: 'Juan Pérez' },
          });
          fireEvent.change(screen.getByPlaceholderText('Ej: 3415555555'), {
            target: { value: '3415555555' },
          });
          await Promise.resolve();
        });

        // Primer submit: falla con 500; el diálogo queda abierto para reintentar.
        await act(async () => {
          fireEvent.click(screen.getByText('Confirmar pedido'));
          await Promise.resolve();
        });
        await waitFor(() => expect(submittedKeys).toHaveLength(1));

        // Reintento del usuario sobre la misma operación lógica.
        await act(async () => {
          fireEvent.click(screen.getByText('Confirmar pedido'));
          await Promise.resolve();
        });
        await waitFor(() =>
          expect(screen.getByText('Pedido creado')).toBeInTheDocument()
        );

        expect(submittedKeys).toHaveLength(2);
        expect(submittedKeys[0]).toBe(submittedKeys[1]);
      }
    );
  });

  describe('tarjeta de sucursal en el encabezado', () => {
    async function renderPedido(branch: Branch) {
      const branches = [branch];

      await act(async () => {
        render(
          <PedidoClient
            branches={branches}
            activeBranch={branch}
            initialProducts={[makeProduct()]}
          />
        );
        await Promise.resolve();
      });
    }

    test('muestra los datos de la sucursal al montar, sin abrir el checkout', async () => {
      await renderPedido(
        makeBranch(1, 'Sucursal A', {
          address: 'Av. Pellegrini 1234, Rosario',
          phones: [{ label: 'Pedidos', number: '3415555555' }],
          socialLinks: [
            { network: 'instagram', url: 'https://instagram.com/pancheria' },
            { network: 'whatsapp', url: '5493415555555' },
          ],
          location: 'https://maps.example.com/sucursal-a',
        })
      );

      const card = screen.getByTestId('branch-info-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent(/Pedí por acá/);
      expect(card).toHaveTextContent('Dirección: Av. Pellegrini 1234, Rosario');
      expect(screen.getByTestId('branch-phone')).toHaveTextContent(
        'Pedidos: 3415555555'
      );

      const socials = screen.getByTestId('branch-social-links');
      expect(socials).toHaveTextContent('Instagram');
      // WhatsApp se muestra como dato informativo, sin enlace wa.me.
      expect(socials).toHaveTextContent('WhatsApp: 5493415555555');
      expect(socials.querySelector('a[href*="wa.me"]')).not.toBeInTheDocument();

      // La ubicación no embebible se muestra como enlace externo.
      const mapLink = screen.getByTestId('branch-map-link');
      expect(mapLink).toHaveTextContent('Ver en mapa');
      expect(mapLink).toHaveAttribute(
        'href',
        'https://maps.example.com/sucursal-a'
      );
      expect(
        screen.queryByTestId('branch-map-frame')
      ).not.toBeInTheDocument();
    });

    test('muestra el mapa embebido solo al abrir la sección cuando la ubicación lo permite', async () => {
      await renderPedido(
        makeBranch(1, 'Sucursal A', {
          location:
            'https://www.openstreetmap.org/?mlat=-32.9468&mlon=-60.6393#map=18/-32.9468/-60.6393',
        })
      );

      const details = screen.getByTestId('branch-map-details');
      expect(details).toBeInTheDocument();
      // El iframe no se monta hasta que el cliente abre la sección.
      expect(
        screen.queryByTestId('branch-map-frame')
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Ver mapa'));
        await Promise.resolve();
      });

      const frame = await screen.findByTestId('branch-map-frame');
      expect(frame).toHaveAttribute(
        'src',
        expect.stringContaining('openstreetmap.org/export/embed.html')
      );
      expect(frame).toHaveAttribute('title', 'Mapa de Sucursal A');
      expect(frame).toHaveAttribute('loading', 'lazy');
      expect(screen.getByTestId('branch-map-link')).toHaveTextContent(
        'Abrir en el mapa'
      );
    });

    test('muestra solo el enlace externo cuando la ubicación no es embebible', async () => {
      await renderPedido(
        makeBranch(1, 'Sucursal A', {
          location: 'https://maps.app.goo.gl/abc123',
        })
      );

      expect(screen.getByTestId('branch-map-link')).toHaveAttribute(
        'href',
        'https://maps.app.goo.gl/abc123'
      );
      expect(
        screen.queryByTestId('branch-map-details')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('branch-map-frame')
      ).not.toBeInTheDocument();
    });
  });
});
