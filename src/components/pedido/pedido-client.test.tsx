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

function createFetchResponse<T>(body: T, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('PedidoClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedUseRouter.mockReturnValue({ push: jest.fn() });
    global.fetch = jest.fn().mockResolvedValue(
      createFetchResponse({
        branch: makeBranch(1, 'Sucursal A'),
        products: [],
      })
    );
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
});
