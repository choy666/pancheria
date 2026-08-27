/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { OrderTracker } from './order-tracker';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const mockFetch = jest.fn();

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  writable: true,
});

describe('OrderTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ push: jest.fn() });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  test('prellena el nombre del cliente desde localStorage', () => {
    const getItem = window.localStorage.getItem as jest.MockedFunction<
      typeof window.localStorage.getItem
    >;
    getItem.mockReturnValue('Juan Pérez');

    render(<OrderTracker />);

    expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
  });

  test('guarda el nombre en localStorage al buscar con éxito', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        order: {
          id: 1,
          orderNumber: 'PED-1-1234567890-abc',
          status: 'pending',
          total: 1200,
          customerName: 'Juan Pérez',
          customerPhone: '3415555555',
          branchId: 1,
          branchName: 'Sucursal A',
        },
      }),
    });

    const setItem = window.localStorage.setItem as jest.MockedFunction<
      typeof window.localStorage.setItem
    >;

    render(<OrderTracker />);

    fireEvent.change(screen.getByLabelText(/Número de pedido/i), {
      target: { value: 'PED-1-1234567890-abc' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), {
      target: { value: 'Juan Pérez' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Buscar pedido/i }));

    await waitFor(() => {
      expect(setItem).toHaveBeenCalledWith(
        'pancheria-last-customer-name',
        'Juan Pérez'
      );
    });
  });

  test('muestra el resultado cuando encuentra el pedido', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        order: {
          id: 1,
          orderNumber: 'PED-1-1234567890-abc',
          status: 'pending',
          total: 1200,
          customerName: 'Juan Pérez',
          customerPhone: '3415555555',
          branchId: 1,
          branchName: 'Sucursal A',
          cancellationToken: 'token',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      }),
    });

    render(<OrderTracker />);

    fireEvent.change(screen.getByLabelText(/Número de pedido/i), {
      target: { value: 'PED-1-1234567890-abc' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), {
      target: { value: 'Juan Pérez' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Buscar pedido/i }));

    await waitFor(() => {
      expect(screen.getByText(/PED-1-1234567890-abc/)).toBeInTheDocument();
    });
  });
});
