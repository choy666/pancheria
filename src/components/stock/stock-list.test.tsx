/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { StockList } from './stock-list';

jest.mock('./stock-history', () => ({
  StockHistory: () => <div data-testid="stock-history" />,
}));

const originalFetch = global.fetch;

function createFetchResponse<T>(body: T, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('StockList', () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  test('muestra skeleton mientras carga', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    render(<StockList />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  test('muestra error cuando la API falla', async () => {
    global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ error: 'Error del servidor' }, false, 500));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Error al cargar stock')).toBeInTheDocument());
  });

  test('muestra error desconocido cuando fetch rechaza con un valor no Error', async () => {
    global.fetch = jest.fn().mockRejectedValue('Error de red');

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Error desconocido')).toBeInTheDocument());
  });

  test('muestra la tabla con productos', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
      {
        id: 2,
        name: 'Gaseosa',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        stock: 2,
        minStock: 5,
        unit: 'lata',
        isLow: true,
      },
    ];
    global.fetch = jest.fn().mockResolvedValue(createFetchResponse(products));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());
    expect(screen.getAllByText('10 unidad').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Gaseosa')).toBeInTheDocument();
    expect(screen.getAllByText('2 lata').length).toBeGreaterThanOrEqual(1);
  });

  test('abre el diálogo de ajuste y guarda un ajuste positivo', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockResolvedValueOnce(createFetchResponse({ productId: 1, newStock: 15 }))
      .mockResolvedValueOnce(createFetchResponse({ error: 'No se pudo recargar' }, false, 500));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');
    const reasonInput = screen.getByLabelText('Motivo');

    fireEvent.change(quantityInput, { target: { value: '5' } });
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/stock',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  test('no actualiza la lista si el recargo de stock falla', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockResolvedValueOnce(createFetchResponse({ productId: 1, newStock: 15 }))
      .mockResolvedValueOnce(createFetchResponse({ error: 'No se pudo recargar' }, false, 500));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');
    const reasonInput = screen.getByLabelText('Motivo');

    fireEvent.change(quantityInput, { target: { value: '5' } });
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(screen.queryByText('Ajustar stock: Pan')).not.toBeInTheDocument();
  });

  test('abre el diálogo de historial', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createFetchResponse(products));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));

    await waitFor(() => expect(screen.getByText('Historial de stock')).toBeInTheDocument());
    expect(screen.getByTestId('stock-history')).toBeInTheDocument();
  });

  test('muestra el error genérico cuando el ajuste es rechazado sin mensaje', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockResolvedValueOnce(createFetchResponse({}, false, 403));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');
    const reasonInput = screen.getByLabelText('Motivo');

    fireEvent.change(quantityInput, { target: { value: '5' } });
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(screen.getByText('Error al ajustar stock')).toBeInTheDocument());
  });

  test('muestra el error del servidor cuando el ajuste es rechazado', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockResolvedValueOnce(createFetchResponse({ error: 'No autorizado' }, false, 403));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');
    const reasonInput = screen.getByLabelText('Motivo');

    fireEvent.change(quantityInput, { target: { value: '5' } });
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(screen.getByText('No autorizado')).toBeInTheDocument());
  });

  test('muestra error desconocido cuando el ajuste falla por red', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockRejectedValueOnce('Error de red');

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');
    const reasonInput = screen.getByLabelText('Motivo');

    fireEvent.change(quantityInput, { target: { value: '5' } });
    fireEvent.change(reasonInput, { target: { value: 'Ajuste de prueba' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(screen.getByText('Error desconocido')).toBeInTheDocument());
  });

  test('pre-llena motivo y envía type restock para carga inicial', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 0,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(createFetchResponse(products))
      .mockResolvedValueOnce(createFetchResponse({ productId: 1, newStock: 10 }))
      .mockResolvedValueOnce(createFetchResponse(products));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    const quantityInput = screen.getByLabelText('Cantidad (positiva para sumar, negativa para restar)');

    fireEvent.change(quantityInput, { target: { value: '10' } });

    await waitFor(() =>
      expect(screen.getByLabelText('Motivo')).toHaveValue('Stock inicial')
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    const adjustCall = (global.fetch as jest.Mock).mock.calls[1];
    const body = JSON.parse(adjustCall[1].body);
    expect(body).toMatchObject({
      productId: 1,
      quantity: 10,
      reason: 'Stock inicial',
      type: 'restock',
    });
  });

  test('cierra el diálogo de ajuste al hacer clic en el botón cerrar', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createFetchResponse(products));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));

    await waitFor(() => expect(screen.getByText('Ajustar stock: Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByText('Ajustar stock: Pan')).not.toBeInTheDocument());
  });

  test('cierra el diálogo de historial al hacer clic en el botón cerrar', async () => {
    const products = [
      {
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 10,
        minStock: 5,
        unit: 'unidad',
        isLow: false,
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createFetchResponse(products));

    render(<StockList />);

    await waitFor(() => expect(screen.getByText('Pan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));

    await waitFor(() => expect(screen.getByText('Historial de stock')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByText('Historial de stock')).not.toBeInTheDocument());
  });
});
