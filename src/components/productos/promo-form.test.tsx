/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { PromoForm } from './promo-form';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('./product-image-uploader', () => ({
  ProductImageUploader: () => <div data-testid="product-image-uploader" />,
}));

jest.mock('./supply-searchable-select', () => ({
  SupplySearchableSelect: ({
    id,
    value,
    onChange,
    supplies,
  }: {
    id?: string;
    value: number;
    onChange: (value: number) => void;
    supplies: { id: number; name: string }[];
  }) => (
    <select
      data-testid={id}
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">Seleccionar insumo</option>
      {supplies.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  ),
  getSupplyGroupKey: () => 'bread',
}));

describe('PromoForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildFetchResponse(body: unknown) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });
  }

  test('muestra el stock de insumos seleccionados y la disponibilidad estimada', async () => {
    const supplies = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        unit: 'unidad',
        stock: 12,
      },
      {
        id: 2,
        name: 'Salchicha',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        unit: 'unidad',
        stock: 8,
      },
    ];

    const recipe = [
      {
        supplyId: 1,
        quantity: 1,
        autoDiscount: true,
        isOptional: false,
        selectedByDefault: false,
        supply: supplies[0],
      },
      {
        supplyId: 2,
        quantity: 2,
        autoDiscount: true,
        isOptional: false,
        selectedByDefault: false,
        supply: supplies[1],
      },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/recetas?productId=')) {
        return buildFetchResponse(recipe);
      }
      return buildFetchResponse(supplies);
    });

    render(
      <PromoForm
        product={{
          id: 10,
          name: 'Panchuque',
          price: 1200,
          isActive: true,
          type: 'compound',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Stock de insumos seleccionados')).toBeInTheDocument();
    });

    const stockItems = screen.getAllByTestId('promo-stock-item');
    expect(stockItems).toHaveLength(2);

    const panItem = stockItems.find(
      (item) => item.getAttribute('data-supply-name') === 'Pan'
    );
    const salchichaItem = stockItems.find(
      (item) => item.getAttribute('data-supply-name') === 'Salchicha'
    );

    expect(panItem).toBeDefined();
    expect(salchichaItem).toBeDefined();

    if (panItem) {
      expect(within(panItem).getByText(/12 unidad en stock/)).toBeInTheDocument();
    }
    if (salchichaItem) {
      expect(
        within(salchichaItem).getByText(/8 unidad en stock/)
      ).toBeInTheDocument();
    }

    // min(12/1, 8/2) = 4
    expect(
      screen.getByText(/Con el stock crítico actual se pueden armar aproximadamente/)
    ).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('no muestra disponibilidad cuando no hay insumos críticos con descuento automático', async () => {
    const supplies = [
      {
        id: 3,
        name: 'Aderezo',
        type: 'manual_supply',
        criticalSupplyType: null,
        unit: 'porción',
        stock: 20,
      },
    ];

    const recipe = [
      {
        supplyId: 3,
        quantity: 1,
        autoDiscount: false,
        isOptional: true,
        selectedByDefault: true,
        supply: supplies[0],
      },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/recetas?productId=')) {
        return buildFetchResponse(recipe);
      }
      return buildFetchResponse(supplies);
    });

    render(
      <PromoForm
        product={{
          id: 11,
          name: 'Promo manual',
          price: 1000,
          isActive: true,
          type: 'compound',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Stock de insumos seleccionados')).toBeInTheDocument();
    });

    const stockItems = screen.getAllByTestId('promo-stock-item');
    expect(stockItems).toHaveLength(1);

    const aderezoItem = stockItems[0];
    expect(aderezoItem.getAttribute('data-supply-name')).toBe('Aderezo');
    expect(within(aderezoItem).getByText(/20 porción en stock/)).toBeInTheDocument();

    expect(
      screen.queryByText(/Con el stock crítico actual/)
    ).not.toBeInTheDocument();
  });
});
