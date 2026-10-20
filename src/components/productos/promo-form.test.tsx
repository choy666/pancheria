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
    onProcessingChange,
  }: {
    value: { source: string };
    onChange: (value: unknown) => void;
    onErrorChange: (error: string | null) => void;
    onProcessingChange?: (processing: boolean) => void;
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
      <button type="button" onClick={() => onProcessingChange?.(true)}>
        Simular procesamiento de imagen
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
    // jsdom no implementa scrollIntoView: el banner de error lo llama.
    Element.prototype.scrollIntoView = jest.fn();
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
    Element.prototype.scrollIntoView = jest.fn();
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

  test('mientras la imagen se procesa, la promo no se crea y el botón queda bloqueado', async () => {
    mockApi();
    render(<PromoForm />);
    await esperarFormulario();

    fireEvent.change(screen.getByLabelText('Nombre de la promo'), {
      target: { value: 'Promo procesando' },
    });
    fireEvent.change(screen.getByTestId('promo-recipe-0'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simular procesamiento de imagen' }));

    const guardar = screen.getByTestId('promo-submit');
    expect(guardar).toBeDisabled();
    fireEvent.submit(guardar.closest('form') as HTMLFormElement);
    expect(cuerpos('POST', '/api/productos')).toHaveLength(0);
    expect(cuerpos('POST', '/api/recetas')).toHaveLength(0);
  });

  test('alta: la descripción se envía al crear la promo', async () => {
    mockApi();
    render(<PromoForm />);
    await esperarFormulario();

    fireEvent.change(screen.getByLabelText('Nombre de la promo'), {
      target: { value: 'Promo con descripción' },
    });
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: '5 panchos + gaseosa 2,25 L' },
    });
    fireEvent.change(screen.getByTestId('promo-recipe-0'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerpos('POST', '/api/recetas')).toHaveLength(1));
    expect(cuerpos('POST', '/api/productos')[0]).toEqual(
      expect.objectContaining({
        name: 'Promo con descripción',
        description: '5 panchos + gaseosa 2,25 L',
      })
    );
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

describe('PromoForm: reglas de receta y errores', () => {
  const pan = {
    id: 1,
    name: 'Pan',
    type: 'critical_supply',
    criticalSupplyType: 'bread',
    unit: 'unidad',
    stock: 12,
  };
  const aderezo = {
    id: 3,
    name: 'Aderezo mayo',
    type: 'manual_supply',
    criticalSupplyType: null,
    unit: 'porción',
    stock: 20,
  };
  const vaso = {
    id: 4,
    name: 'Vaso de gaseosa',
    type: 'service',
    criticalSupplyType: null,
    unit: 'unidad',
    stock: 0,
  };
  const otraPromo = {
    id: 50,
    name: 'Otra promo',
    type: 'compound',
    criticalSupplyType: null,
    unit: 'unidad',
    stock: 0,
  };

  const producto = {
    id: 10,
    name: 'Promo test',
    price: 1500,
    isActive: true,
    type: 'compound' as const,
  };

  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  function mockApi({
    supplies = [pan, aderezo, vaso],
    recipe = [] as unknown[],
    recipePostStatus = 200,
    recipePostBody = {},
  }: {
    supplies?: unknown[];
    recipe?: unknown[];
    recipePostStatus?: number;
    recipePostBody?: unknown;
  } = {}) {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/recetas' && method === 'POST') {
        return jsonResponse(recipePostBody, recipePostStatus);
      }
      if (url.includes('/api/recetas?productId=')) return jsonResponse(recipe);
      if (url.startsWith('/api/productos/') && method === 'PUT') {
        return jsonResponse({});
      }
      return jsonResponse({ items: supplies, total: supplies.length, page: 1, limit: 100 });
    });
  }

  function cuerposReceta(): Record<string, unknown>[] {
    return mockFetch.mock.calls
      .filter(([u, init]) => u === '/api/recetas' && init?.method === 'POST')
      .map(([, init]) => JSON.parse(init.body as string));
  }

  async function esperarFormulario() {
    await waitFor(() =>
      expect(screen.getByTestId('promo-recipe-0')).toBeInTheDocument()
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    Element.prototype.scrollIntoView = jest.fn();
  });

  test('normaliza flags legacy al guardar: manual sucio pasa a opcional y el crítico pierde el preseleccionado', async () => {
    mockApi({
      recipe: [
        // Fila legacy sucia: crítico con selectedByDefault=true.
        { supplyId: 1, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: true, supply: pan },
        // Fila legacy sucia: manual con isOptional=false (causa del 400 en producción).
        { supplyId: 3, quantity: 1, autoDiscount: false, isOptional: false, selectedByDefault: true, supply: aderezo },
      ],
    });
    render(<PromoForm product={producto} />);
    await esperarFormulario();

    fireEvent.click(screen.getByTestId('promo-submit'));

    await waitFor(() => expect(cuerposReceta()).toHaveLength(1));
    const [body] = cuerposReceta();
    const items = body.items as {
      supplyId: number;
      isOptional: boolean;
      autoDiscount: boolean;
      selectedByDefault: boolean;
      supplyType: string;
    }[];
    const itemPan = items.find((i) => i.supplyId === 1)!;
    const itemAderezo = items.find((i) => i.supplyId === 3)!;

    expect(itemPan).toMatchObject({
      isOptional: false,
      autoDiscount: true,
      selectedByDefault: false,
      supplyType: 'critical_supply',
    });
    expect(itemAderezo).toMatchObject({
      isOptional: true,
      autoDiscount: false,
      selectedByDefault: true,
      supplyType: 'manual_supply',
    });
  });

  test('bloquea el guardado si una fila apunta a un insumo inactivo o eliminado', async () => {
    mockApi({
      recipe: [
        { supplyId: 1, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false, supply: pan },
        // El insumo 99 ya no viene en la lista de productos activos.
        { supplyId: 99, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: true, supply: null },
      ],
    });
    render(<PromoForm product={producto} />);
    await esperarFormulario();

    expect(
      screen.getByText(/Este insumo está inactivo o fue eliminado/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(
      await screen.findByText(/apuntan a insumos inactivos o eliminados/)
    ).toBeInTheDocument();
    expect(cuerposReceta()).toHaveLength(0);
  });

  test('las promos no se ofrecen como insumos y una fila legacy con promo queda marcada y bloqueada', async () => {
    mockApi({
      supplies: [pan, aderezo, otraPromo],
      recipe: [
        { supplyId: 1, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false, supply: pan },
        { supplyId: 50, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: false, supply: otraPromo },
      ],
    });
    render(<PromoForm product={producto} />);
    await esperarFormulario();

    // El select no incluye promos ni la propia promo como opciones.
    const opciones = screen.getAllByTestId(/^promo-recipe-\d+$/).flatMap((s) =>
      Array.from(s.querySelectorAll('option')).map((o) => o.textContent)
    );
    expect(opciones).not.toContain('Otra promo');

    expect(
      screen.getByText(/Las promos no pueden ser insumos de otra promo/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(
      await screen.findByText(/usa una promo como insumo/)
    ).toBeInTheDocument();
    expect(cuerposReceta()).toHaveLength(0);
  });

  test('bloquea el guardado si los preseleccionados superan el tope de opcionales', async () => {
    mockApi({
      recipe: [
        { supplyId: 1, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false, supply: pan },
        { supplyId: 3, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: true, supply: aderezo },
        { supplyId: 4, quantity: 1, autoDiscount: false, isOptional: true, selectedByDefault: true, supply: vaso },
      ],
    });
    render(<PromoForm product={{ ...producto, maxOptionalSelections: 1 }} />);
    await esperarFormulario();

    fireEvent.click(screen.getByTestId('promo-submit'));

    expect(
      await screen.findByText(/Hay 2 insumos preseleccionados pero el tope es 1/)
    ).toBeInTheDocument();
    expect(cuerposReceta()).toHaveLength(0);
  });

  test('un 400 del API muestra el detalle y avisa que el producto se guardó pero la receta no', async () => {
    mockApi({
      recipe: [
        { supplyId: 1, quantity: 1, autoDiscount: true, isOptional: false, selectedByDefault: false, supply: pan },
      ],
      recipePostStatus: 400,
      recipePostBody: {
        error: 'Los insumos manuales y servicios son siempre opcionales.',
      },
    });
    render(<PromoForm product={producto} />);
    await esperarFormulario();

    fireEvent.click(screen.getByTestId('promo-submit'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'Los insumos manuales y servicios son siempre opcionales.'
    );
    expect(alerta).toHaveTextContent(
      'Los datos de la promo se guardaron, pero la receta no.'
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
