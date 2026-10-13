/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductForm } from './product-form';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('@/lib/fetch', () => {
  const actual = jest.requireActual<typeof import('@/lib/fetch')>('@/lib/fetch');
  return {
    ...actual,
    authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
  };
});

let mockNextImageValue: unknown = { source: 'none' };
const mockPersistProductImageUpload = jest.fn();

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

jest.mock('@/lib/product-image-upload-client', () => ({
  ...jest.requireActual<typeof import('@/lib/product-image-upload-client')>(
    '@/lib/product-image-upload-client'
  ),
  persistProductImageUpload: (...args: unknown[]) =>
    mockPersistProductImageUpload(...args),
}));

describe('ProductForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  test('renderiza el campo de unidad editable con valor por defecto', () => {
    render(<ProductForm />);

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    expect(unitInput).toBeInTheDocument();
    expect(unitInput.value).toBe('unidad');
  });

  test('mantiene la unidad del producto al editar', () => {
    render(
      <ProductForm
        product={{
          id: 1,
          name: 'Gaseosa',
          description: null,
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          price: 500,
          unit: 'botella',
          stock: 20,
          minStock: 5,
          isActive: true,
        }}
      />
    );

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    expect(unitInput.value).toBe('botella');
  });

  test('permite editar la unidad y la envía al guardar', async () => {
    render(<ProductForm />);

    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Aderezo especial' } });

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    fireEvent.change(unitInput, { target: { value: 'porción' } });
    expect(unitInput.value).toBe('porción');

    const submitButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/productos',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"unit":"porción"'),
        })
      );
    });
  });
});

describe('ProductForm: imagen ilustrativa', () => {
  const bebida = {
    id: 5,
    name: 'Gaseosa',
    description: null,
    type: 'critical_supply' as const,
    criticalSupplyType: 'beverage' as const,
    price: 500,
    unit: 'botella',
    stock: 20,
    minStock: 5,
    isActive: true,
  };

  function respuesta(body: unknown) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  }

  function mockApi(idCreado = 7) {
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      respuesta(
        init?.method === 'POST' && url === '/api/productos' ? { id: idCreado } : {}
      )
    );
  }

  function cuerpos(metodo: string, url: string): Record<string, unknown>[] {
    return mockFetch.mock.calls
      .filter(([u, init]) => u === url && init?.method === metodo)
      .map(([, init]) => JSON.parse(init.body));
  }

  async function seleccionar(id: string, opcion: string) {
    const disparador = document.getElementById(id);
    if (!disparador) throw new Error(`No se encontró el selector #${id}`);
    fireEvent.pointerDown(disparador, { button: 0, pointerType: 'mouse' });
    fireEvent.mouseDown(disparador, { button: 0 });
    fireEvent.click(disparador);
    const opcionElegida = await screen.findByRole('option', { name: opcion });
    fireEvent.pointerDown(opcionElegida, { button: 0, pointerType: 'mouse' });
    fireEvent.click(opcionElegida);
  }

  function elegirImagen(valor: unknown) {
    mockNextImageValue = valor;
    fireEvent.click(screen.getByRole('button', { name: 'Elegir imagen de prueba' }));
  }

  async function nombrarAltaBebida() {
    fireEvent.change(screen.getByLabelText('Nombre', { exact: true }), {
      target: { value: 'Gaseosa' },
    });
    await seleccionar('type', 'Insumo crítico');
    await seleccionar('criticalSupplyType', 'Bebida');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockNextImageValue = { source: 'none' };
    mockApi();
  });

  test('muestra la imagen en bebidas y servicios', () => {
    const { unmount } = render(<ProductForm product={bebida} />);
    expect(screen.getByTestId('product-image-uploader')).toBeInTheDocument();
    unmount();

    render(
      <ProductForm product={{ ...bebida, type: 'service', criticalSupplyType: null }} />
    );
    expect(screen.getByTestId('product-image-uploader')).toBeInTheDocument();
  });

  test('oculta la imagen en insumos que no se venden en el catálogo', () => {
    render(
      <ProductForm product={{ ...bebida, criticalSupplyType: 'bread', name: 'Pan' }} />
    );
    expect(screen.queryByTestId('product-image-uploader')).not.toBeInTheDocument();
  });

  test('edición: una imagen guardada se muestra aunque el tipo no sea vendible', () => {
    render(
      <ProductForm
        product={{
          ...bebida,
          type: 'manual_supply',
          criticalSupplyType: null,
          price: 0,
          imageUrl: 'https://ejemplo.com/aderezo.jpg',
          imageKey: null,
          imageMimeType: null,
          imageSize: null,
        }}
      />
    );
    expect(screen.getByTestId('product-image-uploader')).toHaveAttribute('data-source', 'stored');
  });

  test('edición: quitar la imagen envía imageUrl null en el PUT', async () => {
    render(
      <ProductForm
        product={{
          ...bebida,
          imageUrl: 'https://ejemplo.com/gaseosa.jpg',
          imageKey: null,
          imageMimeType: null,
          imageSize: null,
        }}
      />
    );
    elegirImagen({ source: 'none' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(cuerpos('PUT', '/api/productos/5')).toEqual([
      expect.objectContaining({ imageUrl: null, imageKey: null, imageMimeType: null, imageSize: null }),
    ]);
  });

  test('edición sin cambiar la imagen: el PUT no envía campos de imagen', async () => {
    render(
      <ProductForm
        product={{
          ...bebida,
          imageUrl: 'https://ejemplo.com/gaseosa.jpg',
          imageKey: null,
          imageMimeType: null,
          imageSize: null,
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(cuerpos('PUT', '/api/productos/5')[0]).not.toHaveProperty('imageUrl');
  });

  test('edición con archivo: guarda el producto y después adjunta la imagen', async () => {
    const archivo = new File(['imagen'], 'gaseosa.jpg', { type: 'image/jpeg' });
    render(<ProductForm product={bebida} />);
    elegirImagen({ source: 'upload', file: archivo, previewUrl: 'blob:gaseosa' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(cuerpos('PUT', '/api/productos/5')[0]).not.toHaveProperty('imageUrl');
    expect(mockPersistProductImageUpload).toHaveBeenCalledWith(5, archivo);
  });

  test('con un error de imagen, Guardar queda bloqueado y no envía nada', async () => {
    render(
      <ProductForm
        product={{
          ...bebida,
          imageUrl: 'https://ejemplo.com/gaseosa.jpg',
          imageKey: null,
          imageMimeType: null,
          imageSize: null,
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Simular error de imagen' }));

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    fireEvent.submit(guardar.closest('form') as HTMLFormElement);
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar error de imagen' }));
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  test('alta: una bebida con archivo crea el producto y después adjunta la imagen', async () => {
    const archivo = new File(['imagen'], 'gaseosa.jpg', { type: 'image/jpeg' });
    render(<ProductForm />);
    await nombrarAltaBebida();
    elegirImagen({ source: 'upload', file: archivo, previewUrl: 'blob:gaseosa' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(cuerpos('POST', '/api/productos')[0]).not.toHaveProperty('imageUrl');
    expect(mockPersistProductImageUpload).toHaveBeenCalledWith(7, archivo);
  });

  test('alta: si la subida falla, reintentar actualiza el producto ya creado', async () => {
    mockPersistProductImageUpload.mockRejectedValueOnce(
      new Error('Error al subir la imagen: 500 Internal Server Error')
    );
    const archivo = new File(['imagen'], 'gaseosa.jpg', { type: 'image/jpeg' });
    render(<ProductForm />);
    await nombrarAltaBebida();
    elegirImagen({ source: 'upload', file: archivo, previewUrl: 'blob:gaseosa' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/El producto ya quedó guardado/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(cuerpos('POST', '/api/productos')).toHaveLength(1);
    expect(cuerpos('PUT', '/api/productos/7')).toHaveLength(1);
    expect(mockPersistProductImageUpload).toHaveBeenCalledTimes(2);
  });

  test('alta: al cambiar a insumo manual la sección de imagen se oculta', async () => {
    render(<ProductForm />);
    await nombrarAltaBebida();
    expect(screen.getByTestId('product-image-uploader')).toBeInTheDocument();

    await seleccionar('type', 'Insumo manual');
    expect(screen.queryByTestId('product-image-uploader')).not.toBeInTheDocument();
  });
});
