/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PromoForm } from './promo-form';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('@/lib/fetch', () => ({
  ...jest.requireActual('@/lib/fetch'),
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

let mockNextImageValue: unknown = { source: 'none' };

jest.mock('./product-image-uploader', () => ({
  ProductImageUploader: ({
    value,
    onChange,
    onErrorChange,
  }: {
    value: { source: string };
    onChange: (value: unknown) => void;
    onErrorChange: (error: string | null) => void;
  }) => (
    <div data-testid="product-image-uploader" data-source={value.source}>
      <button type="button" onClick={() => onChange(mockNextImageValue)}>
        Elegir imagen de prueba
      </button>
      <button type="button" onClick={() => onErrorChange('Archivo de prueba inválido.')}>
        Simular error de imagen
      </button>
      <button type="button" onClick={() => onErrorChange(null)}>
        Descartar error de imagen
      </button>
    </div>
  ),
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
      return buildFetchResponse({
        items: supplies,
        total: supplies.length,
        page: 1,
        limit: 100,
      });
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
      return buildFetchResponse({
        items: supplies,
        total: supplies.length,
        page: 1,
        limit: 100,
      });
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

describe('PromoForm: flujo de imagen (caracterización)', () => {
  const originalFetch = global.fetch;

  const supplyPan = {
    id: 1,
    name: 'Pan',
    type: 'critical_supply',
    criticalSupplyType: 'bread',
    unit: 'unidad',
    stock: 12,
  };

  const recetaPan = [
    {
      supplyId: 1,
      quantity: 1,
      autoDiscount: true,
      isOptional: false,
      selectedByDefault: false,
      supply: supplyPan,
    },
  ];

  const promoGuardada = {
    id: 10,
    name: 'Promo guardada',
    price: 1500,
    isActive: true,
    type: 'compound' as const,
    imageUrl: 'https://ejemplo.com/vieja.jpg',
    imageKey: null,
    imageMimeType: null,
    imageSize: null,
  };

  function jsonResponse(body: unknown) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  }

  function mockApi(prepare?: unknown) {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/productos/imagen/preparar') return jsonResponse(prepare);
      if (url === '/api/productos' && method === 'POST') return jsonResponse({ id: 9 });
      if (url.startsWith('/api/productos/') && method === 'PUT') return jsonResponse({});
      if (url === '/api/recetas' && method === 'POST') return jsonResponse({});
      if (url.includes('/api/recetas?productId=')) return jsonResponse(recetaPan);
      return jsonResponse({ items: [supplyPan], total: 1, page: 1, limit: 100 });
    });
  }

  function cuerpos(metodo: string, url: string): Record<string, unknown>[] {
    return mockFetch.mock.calls
      .filter(([u, init]) => u === url && init?.method === metodo)
      .map(([, init]) => JSON.parse(init.body));
  }

  async function esperarFormulario() {
    await waitFor(() =>
      expect(screen.getByTestId('promo-recipe-0')).toBeInTheDocument()
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockNextImageValue = { source: 'none' };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('con un error de imagen, la promo no se crea y el botón queda bloqueado', async () => {
    mockApi();
    render(<PromoForm />);
    await esperarFormulario();

    fireEvent.change(screen.getByLabelText('Nombre de la promo'), {
      target: { value: 'Promo con error' },
    });
    fireEvent.change(screen.getByTestId('promo-recipe-0'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simular error de imagen' }));

    const guardar = screen.getByTestId('promo-submit');
    expect(guardar).toBeDisabled();
    fireEvent.submit(guardar.closest('form') as HTMLFormElement);
    expect(cuerpos('POST', '/api/productos')).toHaveLength(0);
    expect(cuerpos('POST', '/api/recetas')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Descartar error de imagen' }));
    expect(screen.getByTestId('promo-submit')).toBeEnabled();
  });

  test('alta con archivo: sube la imagen y la adjunta al producto creado', async () => {
    const instrucciones = {
      url: 'https://storage.example.com/subida',
      method: 'PUT',
      key: 'product-images/9/promo.jpg',
      publicUrl: 'https://cdn.example.com/product-images/9/promo.jpg',
    };
    mockApi(instrucciones);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    mockNextImageValue = {
      source: 'upload',
      file: new File(['imagen'], 'promo.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:promo',
    };
    render(<PromoForm />);
    await esperarFormulario();

    fireEvent.change(screen.getByLabelText('Nombre de la promo'), {
      target: { value: 'Promo subida' },
    });
    fireEvent.change(screen.getByTestId('promo-recipe-0'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir imagen de prueba' }));
    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerpos('POST', '/api/recetas')).toHaveLength(1));
    expect(global.fetch).toHaveBeenCalledWith(
      instrucciones.url,
      expect.objectContaining({ method: 'PUT' })
    );
    expect(cuerpos('PUT', '/api/productos/9')).toEqual([
      expect.objectContaining({
        imageKey: instrucciones.key,
        imageUrl: instrucciones.publicUrl,
      }),
    ]);
  });

  test('editar: el uploader recibe la imagen guardada y quitarla envía imageUrl null', async () => {
    mockApi();
    mockNextImageValue = { source: 'none' };
    render(<PromoForm product={promoGuardada} />);
    await esperarFormulario();

    expect(screen.getByTestId('product-image-uploader')).toHaveAttribute('data-source', 'stored');
    fireEvent.click(screen.getByRole('button', { name: 'Elegir imagen de prueba' }));
    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerpos('POST', '/api/recetas')).toHaveLength(1));
    expect(cuerpos('PUT', '/api/productos/10')).toContainEqual(
      expect.objectContaining({ imageUrl: null })
    );
  });

  test('editar sin cambiar la imagen no sube nada ni envía campos de imagen', async () => {
    mockApi();
    render(<PromoForm product={promoGuardada} />);
    await esperarFormulario();

    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerpos('POST', '/api/recetas')).toHaveLength(1));
    const [principal] = cuerpos('PUT', '/api/productos/10');
    expect(principal).not.toHaveProperty('imageUrl');
    expect(
      mockFetch.mock.calls.some(([url]) => url === '/api/productos/imagen/preparar')
    ).toBe(false);
  });

  test('si la subida falla después de crear la promo, reintentar actualiza ese mismo producto', async () => {
    mockApi({
      url: 'https://storage.example.com/subida',
      method: 'PUT',
      key: 'product-images/9/promo.jpg',
      publicUrl: 'https://cdn.example.com/product-images/9/promo.jpg',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      })
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    mockNextImageValue = {
      source: 'upload',
      file: new File(['imagen'], 'promo.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:promo',
    };
    render(<PromoForm />);
    await esperarFormulario();

    fireEvent.change(screen.getByLabelText('Nombre de la promo'), {
      target: { value: 'Promo reintento' },
    });
    fireEvent.change(screen.getByTestId('promo-recipe-0'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir imagen de prueba' }));
    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(await screen.findByText(/La promo ya quedó guardada/)).toBeInTheDocument();
    expect(cuerpos('POST', '/api/recetas')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerpos('POST', '/api/recetas')).toHaveLength(1));
    expect(cuerpos('POST', '/api/productos')).toHaveLength(1);
    expect(cuerpos('PUT', '/api/productos/9')).toHaveLength(2);
  });
});
